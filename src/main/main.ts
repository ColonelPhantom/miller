import { app, BrowserWindow, ipcMain } from "electron";
import {
    handleOpenFolder,
    handleReadFile,
    handleSaveFile,
    // handleCreateFile,
    getCurrentWorkspace,
    getOpenedFiles,
    showConfirmDialog,
} from "./fileOperations";
import path from "node:path";
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1152,
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
