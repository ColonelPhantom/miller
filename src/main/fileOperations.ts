// src/main/fileOperations.ts
// Handles file operations for the main process

import { dialog, BrowserWindow } from "electron";
import fs from "fs";
const fsp = fs.promises;
import path from "path";

type FolderTree = {
    name: string;
    path: string;
    type: "directory" | "file";
    children?: FolderTree[];
};

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
        })
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
        return {
            name: path.basename(folderPath),
            path: folderPath,
            type: "directory",
            children: await readTree(folderPath),
        };
    }
    return null;
}
