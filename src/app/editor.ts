import { Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, undo, redo } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { StateEffect } from "@codemirror/state";

import { OpenFile } from "./filestate";

const fixedHeightEditor = EditorView.theme({
    "&": {
        height: "100%",
        minHeight: "1em",
        resize: "horizontal",
        overflow: "auto",
        width: "600px",
        minWidth: "8em",
        flex: "none",
        fontSize: "16px",
    },
    ".cm-scroller": { overflow: "auto scroll" },
});

const testTheme = EditorView.theme({
    "&": {
        width: "600px",
        resize: "horizontal",
    },
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
            extensions: [
                oneDark,
                fixedHeightEditor,
                kmap,
                EditorView.lineWrapping,
            ],
        });
        const language = LanguageDescription.matchFilename(languages, file.filePath)?.load().then((Lang) => {
            let eff = StateEffect.appendConfig.of(Lang);
            let tr = this.view.dispatch({effects: [eff]});
        });

    }

    get dom() {
        return this.view.dom;
    }
}
