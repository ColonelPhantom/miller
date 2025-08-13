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
            // Add other methods as needed
        };
    }
}

export { FolderTree };
