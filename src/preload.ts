// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type { FolderTree } from "./types/global";

// Centralized routing for terminal events: keep a single ipcRenderer listener
// and forward events to subscribed callbacks. Each `onTerminal*` returns an
// unsubscribe function so individual renderer components can remove only
// their own listeners.
const terminalDataCallbacks = new Map<string, (data: string) => void>();
const terminalExitCallbacks = new Map<string, (exitCode: number) => void>();

ipcRenderer.on("terminal:data", (_ev, id: string, data: string) => {
    const cb = terminalDataCallbacks.get(id);
    if (cb) cb(data);
    else console.warn(`No data callback for terminal ${id}`);
});

ipcRenderer.on("terminal:exit", (_ev, id: string, exitCode: number) => {
    const cb = terminalExitCallbacks.get(id);
    if (cb) cb(exitCode);
    else console.warn(`No exit callback for terminal ${id}`);
});

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

    // Get the full workspace tree without triggering dialogs
    getWorkspaceTree: () =>
        ipcRenderer.invoke("workspace:getTree") as Promise<FolderTree | null>,

    showConfirmDialog: (message: string, title: string, buttons: string[]) =>
        ipcRenderer.invoke(
            "dialog:confirm",
            message,
            title,
            buttons,
        ) as Promise<string>,

    // Terminal operations
    createTerminal: (shell?: string, args?: string[]) =>
        ipcRenderer.invoke("terminal:create", shell, args) as Promise<string>,

    resizeTerminal: (id: string, cols: number, rows: number) =>
        ipcRenderer.invoke(
            "terminal:resize",
            id,
            cols,
            rows,
        ) as Promise<boolean>,

    writeToTerminal: (id: string, data: string) =>
        ipcRenderer.invoke("terminal:write", id, data) as Promise<boolean>,

    closeTerminal: (id: string) =>
        ipcRenderer.invoke("terminal:close", id) as Promise<boolean>,

    // Terminal events (subscribe/unsubscribe)
    onTerminalData: (id: string, callback: (data: string) => void) => {
        terminalDataCallbacks.set(id, callback);
        return () => terminalDataCallbacks.delete(id);
    },

    onTerminalExit: (id: string, callback: (exitCode: number) => void) => {
        terminalExitCallbacks.set(id, callback);
        return () => terminalExitCallbacks.delete(id);
    },

    // FS events subscription
    onFsEvent: (callback: (ev: { event: string; path: string }) => void) => {
        ipcRenderer.on(
            "fs:event",
            (_ev, payload: { event: string; path: string }) => {
                callback(payload);
            },
        );
    },
});
