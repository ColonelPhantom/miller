// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type { FolderTree } from "./types/global";

contextBridge.exposeInMainWorld("electronAPI", {
    openFolder: () =>
        ipcRenderer.invoke("dialog:openFolder") as Promise<FolderTree | null>,
});
