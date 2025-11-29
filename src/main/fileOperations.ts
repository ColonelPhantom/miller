// src/main/fileOperations.ts
// Handles file operations for the main process

import { dialog, BrowserWindow } from "electron";
import fs from "fs";
const fsp = fs.promises;
import path from "path";

import * as chokidar from "chokidar";

type FolderTree = {
    name: string;
    path: string;
    type: "directory" | "file";
    children?: FolderTree[];
};

// Track the currently opened folder for security checks
let currentWorkspaceRoot: string | null = null;
let watcher: chokidar.FSWatcher | null = null;

export function getCurrentWorkspaceRoot(): string | null {
  return currentWorkspaceRoot;
}

// Helper to (re)create watcher and wire up IPC notifications to renderer
function ensureWatcher() {
    if (watcher) return watcher;
    watcher = chokidar.watch([], { ignoreInitial: true });

    watcher.on("all", (event, filePath) => {
        console.log("chokidar", event, filePath);
        // Broadcast to all renderer windows
        try {
            BrowserWindow.getAllWindows().forEach((w) =>
                w.webContents.send("fs:event", { event, path: filePath }),
            );
        } catch (err) {
            console.error("Failed to send fs:event to renderer:", err);
        }
    });

    watcher.on("error", (err) => console.error("Watcher error:", err));

    return watcher;
}

// Track previously opened files outside the workspace
const openedFiles = new Set<string>();

async function readTree(dirPath: string): Promise<FolderTree[]> {
    const stats = await fsp.stat(dirPath);
    if (!stats.isDirectory()) return [];
    const names = await fsp.readdir(dirPath);
    const children = await Promise.all(
        names.map(async (name) => {
            const fullPath = path.join(dirPath, name);
            const stat = await fsp.stat(fullPath);
            if (stat.isDirectory()) {
                return {
                    name,
                    path: fullPath,
                    type: "directory" as const,
                    children: await readTree(fullPath),
                };
            } else {
                return {
                    name,
                    path: fullPath,
                    type: "file" as const,
                };
            }
        }),
    );
    return children;
}

export async function handleOpenFolder(
    mainWindow: BrowserWindow,
): Promise<FolderTree | null> {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        currentWorkspaceRoot = folderPath; // Track the opened folder
        // Ensure watcher exists and add this folder to it
        const w = ensureWatcher();
        w.add(folderPath);

        return {
            name: path.basename(folderPath),
            path: folderPath,
            type: "directory",
            children: await readTree(folderPath),
        };
    }
    return null;
}

// Security helper: Check if a path is within the current workspace or previously opened
function isPathSecure(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);

    // Allow if within workspace
    if (currentWorkspaceRoot) {
        const resolvedRoot = path.resolve(currentWorkspaceRoot);

        if (
            resolvedPath.startsWith(resolvedRoot + path.sep) ||
            resolvedPath === resolvedRoot
        ) {
            return true;
        }
    }

    // Allow if previously opened
    if (openedFiles.has(resolvedPath)) {
        return true;
    }

    return false;
}

// File Operations
export async function handleReadFile(
    mainWindow: BrowserWindow,
    filePath?: string,
): Promise<{ content: string; path: string } | null> {
    let targetPath: string;

    if (filePath) {
        // If path is provided, check if it's secure
        if (!isPathSecure(filePath)) {
            throw new Error(
                "Access denied: File is outside the workspace and not previously opened",
            );
        }
        targetPath = filePath;
    } else {
        // Show file dialog
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            defaultPath: currentWorkspaceRoot || undefined,
            // filters: [
            //     { name: "All Files", extensions: ["*"] },
            //     {
            //         name: "Text Files",
            //         extensions: [
            //             "txt",
            //             "md",
            //             "js",
            //             "ts",
            //             "json",
            //             "html",
            //             "css",
            //         ],
            //     },
            // ],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        targetPath = result.filePaths[0];

        // Track files opened via dialog to allow future access
        openedFiles.add(path.resolve(targetPath));
    }

    try {
        const content = await fsp.readFile(targetPath, "utf8");
        return { content, path: targetPath };
    } catch (error) {
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

export async function handleSaveFile(
    mainWindow: BrowserWindow,
    content: string,
    filePath?: string,
): Promise<{ path: string } | null> {
    let targetPath: string;

    if (filePath) {
        // If path is provided, check if it's secure
        if (!isPathSecure(filePath)) {
            throw new Error(
                "Access denied: File is outside the workspace and not previously opened",
            );
        }
        targetPath = filePath;
    } else {
        // Show save dialog
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: currentWorkspaceRoot || undefined,
            // filters: [
            //     { name: "All Files", extensions: ["*"] },
            //     {
            //         name: "Text Files",
            //         extensions: [
            //             "txt",
            //             "md",
            //             "js",
            //             "ts",
            //             "json",
            //             "html",
            //             "css",
            //         ],
            //     },
            // ],
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        targetPath = result.filePath;

        // Track files saved via dialog (always allowed)
        openedFiles.add(path.resolve(targetPath));
    }

    try {
        // Ensure directory exists
        const dir = path.dirname(targetPath);
        await fsp.mkdir(dir, { recursive: true });

        await fsp.writeFile(targetPath, content, "utf8");
        return { path: targetPath };
    } catch (error) {
        throw new Error(`Failed to save file: ${error.message}`);
    }
}

// export async function handleCreateFile(
//     mainWindow: BrowserWindow,
//     fileName: string,
//     content = "",
//     directory?: string,
// ): Promise<{ path: string } | null> {
//     let targetDir: string;

//     if (directory) {
//         // If directory is provided, check if it's secure
//         if (!isPathSecure(directory)) {
//             throw new Error(
//                 "Access denied: Directory is outside the workspace",
//             );
//         }
//         targetDir = directory;
//     } else if (currentWorkspaceRoot) {
//         // Use current workspace root
//         targetDir = currentWorkspaceRoot;
//     } else {
//         // Show directory selection dialog
//         const result = await dialog.showOpenDialog(mainWindow, {
//             properties: ["openDirectory"],
//             title: "Select directory to create file in",
//         });

//         if (result.canceled || result.filePaths.length === 0) {
//             return null;
//         }

//         targetDir = result.filePaths[0];
//     }

//     const targetPath = path.join(targetDir, fileName);

//     // Double-check the final path is secure
//     if (!isPathSecure(targetPath)) {
//         throw new Error("Access denied: Target path is outside the workspace");
//     }

//     try {
//         // Check if file already exists
//         const exists = await fsp
//             .access(targetPath)
//             .then(() => true)
//             .catch(() => false);
//         if (exists) {
//             // Ask user if they want to overwrite
//             const choice = await dialog.showMessageBox(mainWindow, {
//                 type: "question",
//                 buttons: ["Cancel", "Overwrite"],
//                 defaultId: 0,
//                 message: `File "${fileName}" already exists. Do you want to overwrite it?`,
//             });

//             if (choice.response === 0) {
//                 return null; // User cancelled
//             }
//         }

//         await fsp.writeFile(targetPath, content, "utf8");
//         return { path: targetPath };
//     } catch (error) {
//         throw new Error(`Failed to create file: ${error.message}`);
//     }
// }

// Utility function to get current workspace info
export function getCurrentWorkspace(): { root: string | null } {
    return { root: currentWorkspaceRoot };
}

// Return a fresh FolderTree for the current workspace (no dialogs)
export async function getWorkspaceTree(): Promise<FolderTree | null> {
    if (!currentWorkspaceRoot) return null;
    return {
        name: path.basename(currentWorkspaceRoot),
        path: currentWorkspaceRoot,
        type: "directory",
        children: await readTree(currentWorkspaceRoot),
    };
}

// Utility function to get opened files (for debugging/info)
export function getOpenedFiles(): string[] {
    return Array.from(openedFiles);
}

// Show confirmation dialog
export async function showConfirmDialog(
    mainWindow: BrowserWindow,
    message: string,
    title: string,
    buttons: string[] = ["OK", "Cancel"],
): Promise<string> {
    const result = await dialog.showMessageBox(mainWindow, {
        type: "question",
        buttons,
        defaultId: 0,
        title,
        message,
    });
    return buttons[result.response];
}
