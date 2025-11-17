import { Displayable } from "./editorgrid";
import * as xterm from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import van from "vanjs-core";
const v = van.tags;

export class Terminal implements Displayable {
    term: xterm.Terminal;
    currentTitle: string = "Terminal";
    del: () => void;
    dom: HTMLElement;

    setDeleteFunction(del: () => void): void {
        this.del = del;
    }

    title(): string {
        return this.currentTitle;
    }

    constructor() {
        this.term = new xterm.Terminal();

        const fitAddon = new FitAddon();
        this.term.loadAddon(fitAddon);

        this.dom = v.div({ class: "h-full w-full" });
        const loaded = van.state(false);
        van.derive(() => {
            if (loaded.val) {
                this.term.open(this.dom);
                fitAddon.fit();
                this.term.writeln("Welcome to the terminal!");
            }
        });
        loaded.val = true;
    }

    focus() {
        this.term.focus();
    }

    close() {
        this.term.dispose();
        this.del();
    }
}
