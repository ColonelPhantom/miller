// Minimal LSP integration helper for the editor.
// Keeps all LSP-specific logic in one place so it's easy to review.

import { Extension } from "@codemirror/state";

import { LSPClient, languageServerExtensions } from "@codemirror/lsp-client";

// Create a very small MessagePort-based transport implementation
// compatible with @codemirror/lsp-client's expected Transport interface.
async function simpleMessagePortTransport(port: MessagePort) {
    let handlers: ((value: string) => void)[] = [];
    const onMessage = (e: MessageEvent) => {
        const d = e.data;
        if (typeof d === "string") {
            for (const h of handlers) h(d);
        }
    };
    port.addEventListener("message", onMessage);
    // The port must be started to begin receiving messages
    port.start();

    return {
        send(message: string) {
            try {
                port.postMessage(message);
            } catch (err) {
                console.warn("Failed to post message on MessagePort", err);
            }
        },
        subscribe(handler: (value: string) => void) {
            handlers.push(handler);
        },
        unsubscribe(handler: (value: string) => void) {
            handlers = handlers.filter((h) => h !== handler);
        },
    };
}

// Given a local file path like "/home/user/proj/src/foo.ts" produce a
// file:// URI (required by many LSP setups).
function filePathToUri(path: string) {
    // Prefer URL constructor to ensure proper escaping
    try {
        const u = new URL("file://" + path);
        return u.toString();
    } catch (err) {
        console.warn("Failed to convert file path to URI via URL:", err);
        return "file://" + path;
    }
}

// Public helper: attempt to create an LSP extension for `filePath`.
// Returns an empty array (no-op extension) on failure so callers can safely
// reconfigure their compartments with the returned value.
export async function createLspExtension(
    filePath?: string,
): Promise<Extension> {
    if (!filePath) return [];

    // Try to establish a transport via main process MessagePort. This will
    // cause main to spawn (or reuse) an LSP server and hand us a MessagePort
    // connected to it.
    let transport;
    try {
        // Request main process to create/attach an LSP server and transfer a
        // MessagePort into the page. The preload will `postMessage` the port
        // into the page with `{ source: 'electron-lsp' }` when it's ready.
        await window.electronAPI.connectLsp();
        const port = await new Promise<MessagePort>((resolve, reject) => {
            const timeout = setTimeout(() => {
                window.removeEventListener("message", onMessage);
                reject(new Error("Timed out waiting for LSP MessagePort"));
            }, 5000);
            function onMessage(e: MessageEvent) {
                try {
                    if (e.data && e.data.source === "electron-lsp") {
                        const ports = e.ports;
                        if (ports && ports.length > 0) {
                            clearTimeout(timeout);
                            window.removeEventListener("message", onMessage);
                            resolve(ports[0]);
                        }
                    }
                } catch (err) {
                    clearTimeout(timeout);
                    window.removeEventListener("message", onMessage);
                    reject(err);
                }
            }
            window.addEventListener("message", onMessage);
        });
        transport = await simpleMessagePortTransport(port);
    } catch (err) {
        console.warn("Failed to connect to LSP MessagePort:", err);
        return [];
    }

    // Create client and connect
    try {
        // Determine a sensible rootUri for the workspace. Prefer the explicit
        // workspace root reported by the main process, otherwise use the
        // directory containing the file.
        let rootUri: string | undefined = undefined;
        try {
            const ws = await window.electronAPI.getCurrentWorkspace();
            if (ws && ws.root) rootUri = filePathToUri(ws.root);
        } catch (e) {
            // ignore and fall back
            console.warn("Failed to get workspace root from main process:", e);
        }
        if (!rootUri) {
            try {
                const dir = filePath.replace(/\/[^\/]*$/, "");
                rootUri = filePathToUri(dir);
            } catch (e) {
                console.warn("Failed to convert file path to URI via URL:", e);
            }
        }

        const client = new LSPClient({
            extensions: languageServerExtensions(),
            rootUri: rootUri,
        });
        console.log("LSP client created with extensions:", client);
        // Pass a client/connection config containing the rootUri. The librar
        // accepts a config object; we use `as any` to avoid TS errors here.
        client.connect(transport);

        await client.initializing;

        // The client exposes a `plugin` method which yields an extension that
        // wires up autocompletion, diagnostics, and other LSP features for a
        // given URI. We convert the local path to a file:// URI.
        const uri = filePathToUri(filePath);
        return client.plugin(uri);
    } catch (err) {
        console.warn("Failed to create LSP client plugin:", err);
        return [];
    }
}
