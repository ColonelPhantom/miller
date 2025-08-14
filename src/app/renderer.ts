/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

// import "./pico.jade.css";
import "./index.css";

import van from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

import "./foldernav.ts";

const fixedHeightEditor = EditorView.theme({
    "&": {
        height: "100%",
        minHeight: "0px",
        resize: "horizontal",
        overflow: "auto",
        width: "600px",
        minWidth: "8em",
        flex: "none",
    },
    ".cm-scroller": { overflow: "auto" },
});

class EditorColumn {
    view: EditorView;
    wrapper: HTMLElement;

    constructor() {
        this.view = new EditorView({
            doc: "Start document",
            extensions: [basicSetup, oneDark, fixedHeightEditor],
        });
        console.log("Character width: ", this.view.defaultCharacterWidth);
        this.wrapper = v.div({ class: "editorWrapper min-h-0" }, this.view.dom);
    }
    get dom() {
        return this.wrapper;
    }
}

// Create and mount editor list
const editors = vanX.reactive([]);
vanX.list(document.getElementById("editorGrid"), editors, (v) => v.val.dom);

function addView() {
    editors.push(vanX.noreactive(new EditorColumn()));
}

document.getElementById("addEditor")?.addEventListener("click", addView);

addView();
