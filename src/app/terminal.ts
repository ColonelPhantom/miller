import { Displayable } from "./editorgrid";
import * as xterm from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import van, { State } from "vanjs-core";
const v = van.tags;

export class Terminal implements Displayable {
    term: xterm.Terminal;
    currentTitle: State<string> = van.state("Terminal");
    del: () => void;
    dom: HTMLElement;
    private terminalId: string | null = null;
    private fitAddon: FitAddon;
    private resizeObserver: ResizeObserver;
    private unsubTerminalData?: () => void;
    private unsubTerminalExit?: () => void;

    setDeleteFunction(del: () => void): void {
        this.del = del;
    }

    title(): string {
        return this.currentTitle.val;
    }

    constructor() {
        this.term = new xterm.Terminal({
            // cursorBlink: true,
            // fontSize: 14,
            // fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        });

        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);

        this.dom = v.div({ class: "h-full w-2xl resize-x overflow-x-hidden scroll-m-[100px]" });
        this.dom.addEventListener("focusin", () => this.focus());

        const loaded = van.state(false);

        van.derive(() => {
            if (loaded.val) {
                this.initializeTerminal();
            }
        });
        loaded.val = true;
    }

    private async initializeTerminal() {
        this.term.open(this.dom);

        // Create terminal in main process
        try {
            this.terminalId = await window.electronAPI.createTerminal();

            // Set up data handling (subscribe/unsubscribe)
            this.unsubTerminalData = window.electronAPI.onTerminalData(
                this.terminalId,
                (data) => this.term.write(data),
            );

            this.unsubTerminalExit = window.electronAPI.onTerminalExit(
                this.terminalId,
                (exitCode) => {
                    this.term.writeln(
                        `\r\n[Process exited with code ${exitCode}]\r\nPress any key to close...`,
                    );

                    this.term.onData(() => this.close());
                },
            );

            // Handle user input
            this.term.onData((data) => {
                if (this.terminalId) {
                    window.electronAPI.writeToTerminal(this.terminalId, data);
                }
            });

            this.term.onTitleChange((title) => (this.currentTitle.val = title));

            // Set up resize handling
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.dom);

            // Initial fit
            setTimeout(() => {
                this.handleResize();
            }, 100);
        } catch (error) {
            console.error("Failed to initialize terminal:", error);
            this.term.writeln(
                "Failed to initialize terminal. Check console for details.",
            );
        }
    }

    private handleResize() {
        if (
            this.terminalId &&
            this.dom.clientWidth > 0 &&
            this.dom.clientHeight > 0
        ) {
            this.fitAddon.fit();
            const { cols, rows } = this.term;
            window.electronAPI.resizeTerminal(this.terminalId, cols, rows);
        }
    }

    focus() {
        this.dom.scrollIntoView({ behavior: "smooth" });
        this.term.focus();
    }

    close() {
        if (this.terminalId) {
            window.electronAPI.closeTerminal(this.terminalId);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.unsubTerminalData) this.unsubTerminalData();
        if (this.unsubTerminalExit) this.unsubTerminalExit();
        this.term.dispose();
        this.del();
    }
}
