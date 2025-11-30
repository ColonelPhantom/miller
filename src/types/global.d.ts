// src/types/global.d.ts

// FolderTree type for folder structure
type FolderTree = {
    name: string;
    path: string;
    type: "directory" | "file";
    children?: FolderTree[];
};

// Extend the Window interface to include electronAPI
declare global {
    interface Window {
        electronAPI: {
            openFolder: () => Promise<FolderTree | null>;

            // File operations
            readFile: (
                filePath?: string,
            ) => Promise<{ content: string; path: string } | null>;
            saveFile: (
                content: string,
                filePath?: string,
            ) => Promise<{ path: string } | null>;
            // createFile: (fileName: string, content?: string, directory?: string) => Promise<{ path: string } | null>;

            // Workspace info
            getCurrentWorkspace: () => Promise<{ root: string | null }>;
            getOpenedFiles: () => Promise<string[]>;
            // Get workspace tree without dialogs
            getWorkspaceTree: () => Promise<FolderTree | null>;

            // Dialog operations
            showConfirmDialog: (
                message: string,
                title: string,
                buttons: string[],
            ) => Promise<string>;

            // Terminal operations
            createTerminal: (
                shell?: string,
                args?: string[],
            ) => Promise<string>;
            resizeTerminal: (
                id: string,
                cols: number,
                rows: number,
            ) => Promise<boolean>;
            writeToTerminal: (id: string, data: string) => Promise<boolean>;
            closeTerminal: (id: string) => Promise<boolean>;
            onTerminalData: (
                id: string,
                callback: (data: string) => void,
            ) => () => void;
            onTerminalExit: (
                id: string,
                callback: (exitCode: number) => void,
            ) => () => void;
            removeAllTerminalListeners: () => void;
            // Filesystem events
            onFsEvent: (
                callback: (ev: { event: string; path: string }) => void,
            ) => void;

            // Request that the main process create (or reuse) an LSP server and
            // transfer a MessagePort into the page context. Because the
            // ContextBridge cannot directly return MessagePort objects, this
            // function resolves once the port has been transferred to the page
            // via `window.postMessage` and the page should listen for a
            // message with `{ source: 'electron-lsp' }` and take the transferred
            // port from `event.ports[0]`.
            connectLsp: () => Promise<void>;
        };
    }
}

export { FolderTree };
