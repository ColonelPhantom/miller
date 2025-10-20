import { Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, undo, redo } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

import { OpenFile } from "./filestate";

const fixedHeightEditor = EditorView.theme({
    "&": {
        height: "100%",
        minHeight: "0px",
        resize: "horizontal",
        overflow: "auto",
        width: "600px",
        minWidth: "8em",
        flex: "none",
        fontSize: "16px",
    },
    ".cm-scroller": { overflow: "auto scroll" },
});

export class Editor {
    view: EditorView;
    file: OpenFile;

    dispatch(tr: Transaction, inhibitSync = false) {
        this.view.update([tr]);
        if (!inhibitSync) {
            this.file.dispatch({ changes: tr.changes }, this);
        }
    }

    constructor(file: OpenFile) {
        this.file = file;
        const kmap = keymap.of([
            ...defaultKeymap,
            { key: "Mod-z", run: () => undo(file.target) },
            { key: "Mod-shift-z", run: () => redo(file.target) },
        ]);
        this.view = new EditorView({
            doc: file.rootState.doc,
            dispatch: (trs) => this.dispatch(trs),
            extensions: [oneDark, fixedHeightEditor, kmap],
        });
    }

    get dom() {
        return this.view.dom;
    }
}
