import { Transaction, StateEffect } from "@codemirror/state";
import {
    EditorView,
    keymap,
    lineNumbers,
    highlightSpecialChars,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    dropCursor,
    rectangularSelection,
    crosshairCursor,
} from "@codemirror/view";
import { defaultKeymap, undo, redo } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import {
    LanguageDescription,
    foldGutter,
    indentOnInput,
    bracketMatching,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";

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
            ...searchKeymap,
            { key: "Mod-z", run: () => undo(file.target) },
            { key: "Mod-shift-z", run: () => redo(file.target) },
            {
                key: "Ctrl-s",
                run: () => {
                    file.saveFile();
                    return true;
                },
            },
        ]);
        this.view = new EditorView({
            doc: file.rootState.val.doc,
            dispatch: (trs) => this.dispatch(trs),
            extensions: [
                oneDark,
                fixedHeightEditor,
                kmap,
                EditorView.lineWrapping,
                lineNumbers(),
                highlightSpecialChars(),
                foldGutter(),
                drawSelection(),
                dropCursor(),
                // allowMultipleSelections,
                indentOnInput(),
                bracketMatching(),
                // closeBrackets,
                // autocompletion,
                rectangularSelection(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                highlightSelectionMatches(),
                // lintKeymap,
            ],
        });
        const language = LanguageDescription.matchFilename(
            languages,
            file.filePath.val,
        )
            ?.load()
            .then((Lang) => {
                let eff = StateEffect.appendConfig.of(Lang);
                let tr = this.view.dispatch({ effects: [eff] });
            });
    }

    get dom() {
        return this.view.dom;
    }
}
