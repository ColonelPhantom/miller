import {
    ipcMain,
    MessageChannelMain,
    BrowserWindow,
    MessagePortMain,
} from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { getCurrentWorkspaceRoot } from "./fileOperations";

type LspEntry = {
    proc: ChildProcessWithoutNullStreams;
    buffer: Buffer;
    ports: Set<MessagePortMain>;
};

const lspServers = new Map<string, LspEntry>();

// simple fallback mapping for a few languages — prefer env overrides
const fallbackServerForLanguage: Record<string, string | undefined> = {
    typescript: "npx typescript-language-server --log-level 4 --stdio",
    python: "pylsp",
};

function ensureLspForKey(
    serverKey: string,
    language: string | undefined,
    root: string | undefined,
) {
    if (lspServers.has(serverKey)) return lspServers.get(serverKey)!.proc;

    // Determine command for this language
    let raw: string | undefined = undefined;
    if (language) {
        const envKey = `LSP_SERVER_CMD_${language.toUpperCase()}`;
        raw = process.env[envKey];
    }
    raw =
        raw ||
        process.env.LSP_SERVER_CMD ||
        fallbackServerForLanguage[language || ""];
    if (!raw)
        throw new Error(
            `No LSP server command configured for language=${language}`,
        );

    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    const cwd = root || getCurrentWorkspaceRoot() || process.cwd();
    console.log(
        "Starting LSP server:",
        cmd,
        args,
        "cwd=",
        cwd,
        "serverKey=",
        serverKey,
    );

    console.log("Current environment: ", process.env);

    // Spawn using shell:true so PATH and shell resolution behave like a user shell.
    const proc = spawn([cmd].concat(args).join(" "), {
        stdio: ["pipe", "pipe", "pipe"],
        cwd,
        shell: true,
    });
    console.log("LSP server started with PID", proc.pid);
    const entry: LspEntry = { proc, buffer: Buffer.alloc(0), ports: new Set() };
    lspServers.set(serverKey, entry);

    // Buffer stdout and parse LSP-framed messages (Content-Length headers)
    proc.stdout.on("data", (chunk: Buffer) => {
        entry.buffer = Buffer.concat([entry.buffer, Buffer.from(chunk)]);
        // Try to parse as many messages as available
        while (true) {
            const headerEnd = entry.buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) break;
            const header = entry.buffer.subarray(0, headerEnd).toString();
            const m = header.match(/Content-Length:\s*(\d+)/i);
            if (!m) {
                // Malformed, drop
                entry.buffer = entry.buffer.subarray(headerEnd + 4);
                continue;
            }
            const len = parseInt(m[1], 10);
            const totalLen = headerEnd + 4 + len;
            if (entry.buffer.length < totalLen) break; // wait for more
            const body = entry.buffer.subarray(headerEnd + 4, totalLen).toString();
            // Forward body to all attached ports
            try {
                entry.ports.forEach((p) => {
                    try {
                        p.postMessage(body);
                    } catch (err) {
                        console.warn(
                            "Failed to post to port on serverKey",
                            serverKey,
                            err,
                        );
                    }
                });
            } catch (err) {
                console.warn("Failed to forward LSP message to renderer", err);
            }
            entry.buffer = entry.buffer.subarray(totalLen);
        }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
        console.error("LSP stderr:", chunk.toString());
    });

    proc.on("exit", (code, signal) => {
        console.log("LSP server exited", code, signal, serverKey);
        lspServers.delete(serverKey);
        try {
            // broadcast exit event to all renderers
            BrowserWindow.getAllWindows().forEach((w) =>
                w.webContents.send("lsp:exit", { code, signal, serverKey }),
            );
        } catch (err) {
            console.warn("Failed to broadcast LSP exit event:", err);
        }
    });

    return proc;
}

export function setupLangServer() {
    ipcMain.handle(
        "lsp:connect",
        async (event, opts?: { language?: string; root?: string }) => {
            const sender = event.sender;
            const language = opts?.language;
            const root =
                opts?.root || getCurrentWorkspaceRoot() || process.cwd();
            const publicKey = `${language || "auto"}::${root}`; // visible to renderer
            const internalKey = `${sender.id}::${publicKey}`; // unique per renderer

            let proc: ChildProcessWithoutNullStreams;
            try {
                proc = ensureLspForKey(internalKey, language, root);
            } catch (err) {
                console.error("Failed to ensure LSP server:", err);
                return { ok: false, error: (err as Error).message };
            }

            // Create a MessageChannelMain and hand one port to the renderer.
            const { port1, port2 } = new MessageChannelMain();

            // Ensure port1 is started (MessagePortMain has start()).
            port1.start();

            // When renderer posts a message on port1, forward to LSP server stdin.
            port1.on("message", (arg) => {
                let data: any = arg;
                try {
                    if (arg && typeof arg === "object" && "data" in arg)
                        data = (arg as any).data;
                } catch (e) {
                    data = arg;
                }
                if (typeof data === "string") {
                    // Wrap in Content-Length header
                    const buf = Buffer.from(data, "utf8");
                    const header = Buffer.from(
                        `Content-Length: ${buf.length}\r\n\r\n`,
                        "utf8",
                    );
                    try {
                        proc.stdin.write(Buffer.concat([header, buf]));
                    } catch (err) {
                        console.warn("Failed to write to LSP stdin", err);
                    }
                }
            });

            // Attach this port to the server entry so stdout gets forwarded to it
            const entry = lspServers.get(internalKey);
            if (entry) entry.ports.add(port1);

            // Transfer port2 to renderer along with metadata (serverKey, language)
            try {
                event.sender.postMessage(
                    "lsp:port",
                    { serverKey: publicKey, language },
                    [port2],
                );
            } catch (err) {
                console.error(
                    "Failed to send LSP MessagePort to renderer:",
                    err,
                );
                return { ok: false, error: (err as Error).message };
            }
            return { ok: true, serverKey: publicKey };
        },
    );
}
