// src/types/global.d.ts

// Extend the Window interface to include electronAPI
interface Window {
    electronAPI: {
        openFolder: () => Promise<string>;
        // Add other methods as needed
    };
}
