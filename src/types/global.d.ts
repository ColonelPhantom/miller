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

            // Dialog operations
            showConfirmDialog: (
                message: string,
                title: string,
                buttons: string[],
            ) => Promise<string>;
        };
    }
}

export { FolderTree };
