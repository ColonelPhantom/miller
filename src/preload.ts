// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type { FolderTree } from "./types/global";

contextBridge.exposeInMainWorld("electronAPI", {
    openFolder: () =>
        ipcRenderer.invoke("dialog:openFolder") as Promise<FolderTree | null>,

    // File operations
    readFile: (filePath?: string) =>
        ipcRenderer.invoke("file:read", filePath) as Promise<{
            content: string;
            path: string;
        } | null>,

    saveFile: (content: string, filePath?: string) =>
        ipcRenderer.invoke("file:save", content, filePath) as Promise<{
            path: string;
        } | null>,

    // createFile: (fileName: string, content = "", directory?: string) =>
    //     ipcRenderer.invoke(
    //         "file:create",
    //         fileName,
    //         content,
    //         directory,
    //     ) as Promise<{ path: string } | null>,

    getCurrentWorkspace: () =>
        ipcRenderer.invoke("workspace:getCurrentInfo") as Promise<{
            root: string | null;
        }>,

    getOpenedFiles: () =>
        ipcRenderer.invoke("workspace:getOpenedFiles") as Promise<string[]>,
});
