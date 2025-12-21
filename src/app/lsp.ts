// Minimal LSP integration helper for the editor.
// Keeps all LSP-specific logic in one place so it's easy to review.

import { Extension, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import {
    LSPClient,
    LSPPlugin,
    Workspace,
    hoverTooltips,
    signatureHelp,
} from "@codemirror/lsp-client";

import { serverCompletion } from "./lsp/completion";
import { OpenFile } from "./filestate";
import { serverDiagnostics } from "./lsp/diagnostics";

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

// Map of active clients keyed by `${language}::${rootUri}`
const clients = new Map<
    string,
    {
        client: LSPClient;
        transport?: any;
    }
>();

export function inferLanguageFromPath(
    filePath: string | undefined,
): string | undefined {
    if (!filePath) return undefined;
    const m = filePath.match(/\.([^.\/]+)$/);
    if (!m) return undefined;
    const ext = m[1].toLowerCase();
    if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx")
        return "typescript";
    if (ext === "py") return "python";
    // add more mappings as needed
    return undefined;
}

// Workspace implementation that maps our OpenFile model to the LSP client's
// expectations. This supports multiple views per OpenFile by using the
// OpenFile.getView method.
class OpenFileWorkspace extends Workspace {
    files: OpenFile[] = [];
    private fileVersions: { [uri: string]: number } = Object.create(null);

    nextFileVersion(uri: string) {
        return (this.fileVersions[uri] = (this.fileVersions[uri] ?? -1) + 1);
    }

    constructor(client: LSPClient) {
        super(client);
    }

    // Look through known workspace files and update their docs/versions
    // based on the editor views or the OpenFile state when no view exists.
    syncFiles() {
        const result = [];
        for (const file of this.files) {
            const prevDoc = file.doc;
            const changes = file.changes;
            if (changes && !changes.empty) {
                result.push({ file, prevDoc, changes });
                file.doc = file.rootState.val.doc;
                file.version = this.nextFileVersion(file.uri);
                file.clearChanges();
            }
            for (const e of file.editors) {
                const plugin = LSPPlugin.get(e.view);
                if (plugin) {
                    plugin.clear();
                }
            }
        }
        return result;
    }

    openFile(uri: string, languageId: string, view: EditorView) {
        console.log("LSP: attempting to open file", uri);
        if (this.getFile(uri)) return;
        // Try to map to an existing OpenFile instance, prefer using its doc
        const path = uri.replace(/^file:\/\//, "");
        const of = OpenFile.findOpenFile(path);
        if (!of) {
            console.warn("LSP: attempted to open unknown file", uri);
            return;
        }
        of.doc = view.state.doc;
        this.files.push(of);
        this.client.didOpen(of);
    }

    updateFile(uri: string, update: TransactionSpec): void {
        const file = this.getFile(uri) as OpenFile;
        if (!file) {
            console.warn("LSP: attempted to update unknown file", uri);
            return;
        }
        // TODO: maybe couple undos across editors for things like LSP rename?
        file.dispatch(update);
    }

    closeFile(uri: string, view: EditorView) {
        const path = uri.replace(/^file:\/\//, "");
        const of = OpenFile.findOpenFile(path);
        // If OpenFile exists and still has editors, defer closing
        console.log("LSP: attempting to close file", uri, of);
        if (of && of.editors.length > 0) return;
        this.files = this.files.filter((f) => f.uri !== uri);
        console.log("LSP: closing file", uri);
        this.client.didClose(uri);
    }
}

// Public helper: attempt to create an LSP extension for `filePath`.
// Returns an empty array (no-op extension) on failure so callers can safely
// reconfigure their compartments with the returned value.
export async function createLspExtension(
    filePath?: string,
): Promise<Extension> {
    if (!filePath) return [];
    // Determine workspace root (filesystem path) and a file:// URI for LSP
    let rootPath: string | undefined = undefined;
    let rootUri: string | undefined = undefined;
    try {
        const ws = await window.electronAPI.getCurrentWorkspace();
        if (ws && ws.root) {
            rootPath = ws.root;
            rootUri = filePathToUri(ws.root);
        }
    } catch (e) {
        console.warn("Failed to get workspace root from main process:", e);
    }
    if (!rootPath) {
        try {
            const dir = filePath.replace(/\/[^\/]*$/, "");
            rootPath = dir;
            rootUri = filePathToUri(dir);
        } catch (e) {
            console.warn("Failed to derive workspace dir from file path:", e);
        }
    }

    const language = inferLanguageFromPath(filePath);
    const serverKey = `${language || "auto"}::${rootPath || ""}`;

    // Reuse existing client if available
    if (clients.has(serverKey)) {
        const entry = clients.get(serverKey)!;
        await entry.client.initializing;
        try {
            const uri = filePathToUri(filePath);
            const ext = entry.client.plugin(uri);
            return ext;
        } catch (err) {
            console.warn(
                "Failed to create LSP plugin from existing client:",
                err,
            );
            return [];
        }
    }

    // Otherwise request a new server/port from main and create a client
    try {
        // Pass a filesystem root path to main so it can set cwd correctly.
        await window.electronAPI.connectLsp({ language, root: rootPath });
    } catch (err) {
        console.warn("Failed to request LSP server from main:", err);
        return [];
    }

    let port: MessagePort;
    try {
        port = await new Promise<MessagePort>((resolve, reject) => {
            const timeout = setTimeout(() => {
                window.removeEventListener("message", onMessage);
                reject(new Error("Timed out waiting for LSP MessagePort"));
            }, 5000);
            function onMessage(e: MessageEvent) {
                try {
                    if (
                        e.data &&
                        e.data.source === "electron-lsp" &&
                        e.data.serverKey === serverKey
                    ) {
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
    } catch (err) {
        console.warn("Failed to receive LSP MessagePort:", err);
        return [];
    }

    let transport;
    try {
        transport = await simpleMessagePortTransport(port);
    } catch (err) {
        console.warn("Failed to create transport from MessagePort:", err);
        return [];
    }

    try {
        const client = new LSPClient({
            extensions: [
                serverDiagnostics(),
                serverCompletion(),
                hoverTooltips(),
                signatureHelp(),
            ],
            rootUri: rootUri,
            workspace: (c) => new OpenFileWorkspace(c),
        });
        client.connect(transport);
        await client.initializing;

        // Store client.
        clients.set(serverKey, { client, transport });

        const uri = filePathToUri(filePath);
        return client.plugin(uri);
    } catch (err) {
        console.warn("Failed to create LSP client plugin:", err);
        return [];
    }
}
