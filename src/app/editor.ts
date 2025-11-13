import { Transaction, Compartment, Extension } from "@codemirror/state";
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
    foldKeymap,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import van from "vanjs-core";

import { OpenFile } from "./filestate";
import { Displayable } from "./editorgrid";

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

export class Editor implements Displayable {
    view: EditorView;
    file: OpenFile;
    deleteFn?: () => void;

    private wordWrapCompartment = new Compartment();
    private languageCompartment = new Compartment();

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
            ...foldKeymap,
            { key: "Mod-z", run: () => undo(file.target) },
            { key: "Mod-shift-z", run: () => redo(file.target) },
            {
                key: "Ctrl-s",
                run: () => {
                    file.saveFile();
                    return true;
                },
            },
            { key: "Mod-w", run: () => this.close() },
            {
                key: "Alt-z",
                run: () => {
                    this.toggleExt(
                        this.wordWrapCompartment,
                        EditorView.lineWrapping,
                    );
                    return true;
                },
            },
            { key: "Alt--", run: () => this.changeWidth(-100) },
            { key: "Alt-=", run: () => this.changeWidth(100) },
        ]);
        this.view = new EditorView({
            doc: file.rootState.val.doc,
            dispatch: (trs) => this.dispatch(trs),
            extensions: [
                oneDark,
                fixedHeightEditor,
                kmap,
                this.wordWrapCompartment.of(EditorView.lineWrapping),
                this.languageCompartment.of([]),
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

        van.derive(() => {
            LanguageDescription.matchFilename(languages, file.filePath.val)
                ?.load()
                .then((Lang) => {
                    // const eff = StateEffect.appendConfig.of(Lang);
                    const eff = this.languageCompartment.reconfigure(Lang);
                    this.view.dispatch({ effects: [eff] });
                });
        });
    }

    get dom() {
        return this.view.dom;
    }

    focus() {
        this.view.dom.scrollIntoView();
        this.view.focus();
    }

    title(): string {
        return this.file.filePath.val + (this.file.isDirty() ? "*" : "");
    }

    changeWidth(increment: number) {
        const w = parseInt(window.getComputedStyle(this.view.dom).width, 10);
        this.view.dom.style.width = w + increment + "px";
        return true;
    }

    close() {
        if (this.deleteFn) {
            this.file.removeEditor(this, this.deleteFn);
            return true;
        }
        return false;
    }

    toggleExt(compartment: Compartment, extension: Extension) {
        const on = compartment.get(this.view.state) == extension;
        this.view.dispatch({
            effects: compartment.reconfigure(on ? [] : extension),
        });
    }

    setDeleteFunction(fn: () => void) {
        this.deleteFn = fn;
    }
}
