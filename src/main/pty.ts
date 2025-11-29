import * as pty from "node-pty";
import { getCurrentWorkspaceRoot } from "./fileOperations";

export interface TerminalInstance {
    ptyProcess: pty.IPty;
}

export class TerminalManager {
    private terminals: Map<string, TerminalInstance> = new Map();
    private nextId: number = 1;

    createTerminal(
        event: Electron.IpcMainInvokeEvent,
        shell?: string,
        args?: string[],
    ): string {
        const id = `terminal-${this.nextId++}`;

        // Default shell based on platform
        const defaultShell =
            process.platform === "win32" ? "powershell.exe" : "/bin/bash";
        const shellToUse = shell || defaultShell;

        const ptyProcess = pty.spawn(shellToUse, args || [], {
            name: "xterm-color",
            cols: 80,
            rows: 24,
            cwd: getCurrentWorkspaceRoot() || process.cwd(),
            env: process.env,
        });

        const terminal: TerminalInstance = {
            ptyProcess,
        };

        ptyProcess.onData((data) => {
            event.sender.send("terminal:data", id, data);
        });

        ptyProcess.onExit(({ exitCode }) => {
            event.sender.send("terminal:exit", id, exitCode);
            this.terminals.delete(id);
        });

        this.terminals.set(id, terminal);
        return id;
    }

    resizeTerminal(id: string, cols: number, rows: number): boolean {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.ptyProcess.resize(cols, rows);
            return true;
        }
        return false;
    }

    writeToTerminal(id: string, data: string): boolean {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.ptyProcess.write(data);
            return true;
        }
        return false;
    }

    closeTerminal(id: string): boolean {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.ptyProcess.kill();
            this.terminals.delete(id);
            return true;
        }
        return false;
    }
}

export const terminalManager = new TerminalManager();
