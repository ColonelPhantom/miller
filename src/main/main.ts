import { app, BrowserWindow, ipcMain, MessageChannelMain } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import {
    handleOpenFolder,
    handleReadFile,
    handleSaveFile,
    // handleCreateFile,
    getOpenedFiles,
    showConfirmDialog,
    getWorkspaceTree,
    getCurrentWorkspaceRoot,
    getCurrentWorkspace,
} from "./fileOperations";
import { terminalManager } from "./pty";
import path from "node:path";
import started from "electron-squirrel-startup";
/// <reference types="./forge-vite-env.d.ts" />

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

app.setName("miller");

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1152,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
        icon: "./resources/icon.png",
    });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);

        // Open the DevTools only in dev mode
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(
            path.join(
                __dirname,
                `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
            ),
        );
    }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(() => {
    ipcMain.handle("dialog:openFolder", async (event) => {
        // Use the sender's window for correct dialog association
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        return await handleOpenFolder(senderWindow);
    });

    // File operation handlers
    ipcMain.handle("file:read", async (event, filePath?: string) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        return await handleReadFile(senderWindow, filePath);
    });

    ipcMain.handle(
        "file:save",
        async (event, content: string, filePath?: string) => {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            return await handleSaveFile(senderWindow, content, filePath);
        },
    );

    // ipcMain.handle("file:create", async (event, fileName: string, content = '', directory?: string) => {
    //     const senderWindow = BrowserWindow.fromWebContents(event.sender);
    //     return await handleCreateFile(senderWindow, fileName, content, directory);
    // });

    ipcMain.handle("workspace:getCurrentInfo", () => {
        return getCurrentWorkspace();
    });

    ipcMain.handle("workspace:getOpenedFiles", () => {
        return getOpenedFiles();
    });

    // Return folder tree without showing dialogs
    ipcMain.handle("workspace:getTree", async () => {
        return await getWorkspaceTree();
    });

    ipcMain.handle(
        "dialog:confirm",
        async (event, message: string, title: string, buttons: string[]) => {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            return await showConfirmDialog(
                senderWindow,
                message,
                title,
                buttons,
            );
        },
    );

    // Terminal handlers

    // LSP server manager: spawn a server per renderer and expose a MessagePort
    // to the renderer so it can communicate with the server using MessagePort
    // instead of websockets.
    const lspServers = new Map<
        number,
        {
            proc: ChildProcessWithoutNullStreams;
            buffer: Buffer;
            postMessage?: (msg: string) => void;
        }
    >();

    function startLspForWebContents(sender: Electron.WebContents) {
        const id = sender.id;
        if (lspServers.has(id)) return lspServers.get(id)!.proc;

        // Allow overriding command via env LSP_SERVER_CMD (eg "typescript-language-server --stdio")
        const raw =
            process.env.LSP_SERVER_CMD ||
            "npx typescript-language-server --log-level 4 --stdio";
        const parts = raw.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);
        const cwd = getCurrentWorkspaceRoot() || process.cwd();
        console.log("Starting LSP server:", cmd, args, "cwd=", cwd);

        const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], cwd });
        const entry = { proc, buffer: Buffer.alloc(0) };
        lspServers.set(id, entry);

        // Buffer stdout and parse LSP-framed messages (Content-Length headers)
        proc.stdout.on("data", (chunk: Buffer) => {
            entry.buffer = Buffer.concat([entry.buffer, Buffer.from(chunk)]);
            console.log("LSP stdout chunk:", chunk.toString());
            // Try to parse as many messages as available
            while (true) {
                const headerEnd = entry.buffer.indexOf("\r\n\r\n");
                if (headerEnd === -1) break;
                const header = entry.buffer.slice(0, headerEnd).toString();
                const m = header.match(/Content-Length:\s*(\d+)/i);
                if (!m) {
                    // Malformed, drop
                    entry.buffer = entry.buffer.slice(headerEnd + 4);
                    continue;
                }
                const len = parseInt(m[1], 10);
                const totalLen = headerEnd + 4 + len;
                if (entry.buffer.length < totalLen) break; // wait for more
                const body = entry.buffer
                    .slice(headerEnd + 4, totalLen)
                    .toString();
                // Forward body to renderer via the per-server postMessage callback
                try {
                    if (entry.postMessage) entry.postMessage(body);
                    else sender.send("lsp:message", body);
                } catch (err) {
                    console.warn(
                        "Failed to forward LSP message to renderer",
                        err,
                    );
                }
                entry.buffer = entry.buffer.slice(totalLen);
            }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            console.error("LSP stderr:", chunk.toString());
        });

        proc.on("exit", (code, signal) => {
            console.log("LSP server exited", code, signal);
            lspServers.delete(id);
            try {
                sender.send("lsp:exit", { code, signal });
            } catch (err) {
                /* ignore */
            }
        });

        return proc;
    }

    ipcMain.handle("lsp:connect", async (event) => {
        // Start LSP server for this renderer
        const sender = event.sender;
        const proc = startLspForWebContents(sender);

        // Create a MessageChannelMain and hand one port to the renderer.
        const { port1, port2 } = new MessageChannelMain();

        // Ensure port1 is started (MessagePortMain has start()).
        try {
            port1.start?.();
        } catch (err) {
            // ignore
        }

        // When renderer posts a message on port1, forward to LSP server stdin.
        // Support both shapes: some implementations emit an event-like object
        // with `.data`, others deliver the message as the first arg.
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
                    console.log("renderer -> LSP:", data);
                    proc.stdin.write(Buffer.concat([header, buf]));
                } catch (err) {
                    console.warn("Failed to write to LSP stdin", err);
                }
            }
        });

        // Make stdout-forwarding use port1 if available
        const entry = lspServers.get(sender.id) as any;
        if (entry)
            entry.postMessage = (msg: string) => {
                console.log("LSP -> renderer:", msg);
                try {
                    port1.postMessage(msg);
                } catch (err) {
                    console.warn("Failed to post to port1:", err);
                }
            };

        // Transfer port2 to renderer
        try {
            event.sender.postMessage("lsp:port", null, [port2]);
        } catch (err) {
            console.error("Failed to send LSP MessagePort to renderer:", err);
            return false;
        }
        return true;
    });

    // Terminal handlers
    ipcMain.handle(
        "terminal:create",
        async (event, shell?: string, args?: string[]) => {
            return terminalManager.createTerminal(event, shell, args);
        },
    );

    ipcMain.handle(
        "terminal:resize",
        async (event, id: string, cols: number, rows: number) => {
            return terminalManager.resizeTerminal(id, cols, rows);
        },
    );

    ipcMain.handle(
        "terminal:write",
        async (event, id: string, data: string) => {
            return terminalManager.writeToTerminal(id, data);
        },
    );

    ipcMain.handle("terminal:close", async (event, id: string) => {
        return terminalManager.closeTerminal(id);
    });

    createWindow();
    if (process.platform === "darwin") {
        app.on("activate", function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
