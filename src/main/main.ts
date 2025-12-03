import { app, BrowserWindow, ipcMain } from "electron";
import {
    handleOpenFolder,
    handleReadFile,
    handleSaveFile,
    // handleCreateFile,
    getOpenedFiles,
    showConfirmDialog,
    getWorkspaceTree,
    getCurrentWorkspace,
} from "./fileOperations";
import { terminalManager } from "./pty";
import path from "node:path";
import started from "electron-squirrel-startup";
import { setupLangServer } from "./langserver";
import { setMenu } from "./menu";
/// <reference types="./forge-vite-env.d.ts" />

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

app.setName("miller");
setMenu();

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
        icon: "./resources/icon.png",
    });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);

        // Open the DevTools only in dev mode
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(
            path.join(
                __dirname,
                `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
            ),
        );
    }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(() => {
    ipcMain.handle("dialog:openFolder", async (event) => {
        // Use the sender's window for correct dialog association
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        return await handleOpenFolder(senderWindow);
    });

    // File operation handlers
    ipcMain.handle("file:read", async (event, filePath?: string) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        return await handleReadFile(senderWindow, filePath);
    });

    ipcMain.handle(
        "file:save",
        async (event, content: string, filePath?: string) => {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            return await handleSaveFile(senderWindow, content, filePath);
        },
    );

    // ipcMain.handle("file:create", async (event, fileName: string, content = '', directory?: string) => {
    //     const senderWindow = BrowserWindow.fromWebContents(event.sender);
    //     return await handleCreateFile(senderWindow, fileName, content, directory);
    // });

    ipcMain.handle("workspace:getCurrentInfo", () => {
        return getCurrentWorkspace();
    });

    ipcMain.handle("workspace:getOpenedFiles", () => {
        return getOpenedFiles();
    });

    // Return folder tree without showing dialogs
    ipcMain.handle("workspace:getTree", async () => {
        return await getWorkspaceTree();
    });

    ipcMain.handle(
        "dialog:confirm",
        async (event, message: string, title: string, buttons: string[]) => {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            return await showConfirmDialog(
                senderWindow,
                message,
                title,
                buttons,
            );
        },
    );

    // Terminal handlers

    // LSP server manager moved to src/main/langserver.ts
    // It is initialized below via setupLangServer().
    setupLangServer();

    // Terminal handlers
    ipcMain.handle(
        "terminal:create",
        async (event, shell?: string, args?: string[]) => {
            return terminalManager.createTerminal(event, shell, args);
        },
    );

    ipcMain.handle(
        "terminal:resize",
        async (event, id: string, cols: number, rows: number) => {
            return terminalManager.resizeTerminal(id, cols, rows);
        },
    );

    ipcMain.handle(
        "terminal:write",
        async (event, id: string, data: string) => {
            return terminalManager.writeToTerminal(id, data);
        },
    );

    ipcMain.handle("terminal:close", async (event, id: string) => {
        return terminalManager.closeTerminal(id);
    });

    createWindow();
    if (process.platform === "darwin") {
        app.on("activate", function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
