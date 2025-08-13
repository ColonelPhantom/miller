// src/main/fileOperations.ts
// Handles file operations for the main process

import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

export async function handleOpenFolder(mainWindow: BrowserWindow) {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    return folderPath;
  }
  return null;
}

export function readFolderContents(folderPath: string): string[] {
  try {
    return fs.readdirSync(folderPath).map(file => path.join(folderPath, file));
  } catch (err) {
    console.error('Error reading folder:', err);
    return [];
  }
}
