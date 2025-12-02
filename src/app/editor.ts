import {
    Transaction,
    Compartment,
    Extension,
    StateEffect,
    StateField,
    EditorState,
} from "@codemirror/state";
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
    showPanel,
} from "@codemirror/view";
import { defaultKeymap, undo, redo, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import {
    LanguageDescription,
    foldGutter,
    indentOnInput,
    bracketMatching,
    foldKeymap,
    indentUnit,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import van from "vanjs-core";
import { Displayable } from "./displayable";
import { createLspExtension } from "./lsp";

import { OpenFile } from "./filestate";
import {
    findReferencesKeymap,
    formatKeymap,
    jumpToDefinitionKeymap,
    renameKeymap,
} from "@codemirror/lsp-client";

const fixedHeightEditor = EditorView.theme({
    "&": {
        height: "100%",
        minHeight: "1em",
        resize: "horizontal",
        overflow: "auto",
        width: "768px",
        minWidth: "8em",
        flex: "none",
        fontSize: "16px",
        scrollMargin: "100px",
    },
    ".cm-scroller": { overflow: "auto scroll" },
});

const FileStatusEffect = StateEffect.define<string | null>();
const FileStatusField = StateField.define<string | null>({
    create: () => null,
    update(value, tr): string | null {
        for (const effect of tr.effects) {
            if (effect.is(FileStatusEffect)) {
                value = effect.value;
            }
        }
        return value;
    },
    provide: (f) =>
        showPanel.from(f, (state) => (state ? fileStatusPanel : null)),
});

function fileStatusPanel(view: EditorView) {
    const dom = document.createElement("div");
    dom.textContent = view.state.field(FileStatusField);
    dom.style =
        "padding: 2px 10px; font-size: 12px; color: white; background: #900;";
    return { top: true, dom };
}
export class Editor extends Displayable {
    view: EditorView;
    file: OpenFile;

    private wordWrapCompartment = new Compartment();
    private languageCompartment = new Compartment();
    private lspCompartment = new Compartment();

    dispatch(tr: Transaction, inhibitSync = false) {
        this.view.update([tr]);
        if (!inhibitSync) {
            this.file.dispatch({ changes: tr.changes }, this);
        }
    }

    constructor(file: OpenFile) {
        super();
        this.file = file;
        const kmap = keymap.of([
            ...defaultKeymap,
            ...searchKeymap,
            ...foldKeymap,

            ...lintKeymap,
            ...jumpToDefinitionKeymap,
            ...findReferencesKeymap,
            ...formatKeymap,
            ...renameKeymap,
            indentWithTab,
            { key: "Mod-z", run: () => undo(file.target) },
            { key: "Mod-shift-z", run: () => redo(file.target) },
            {
                key: "Ctrl-s",
                run: () => {
                    file.saveFile();
                    return true;
                },
            },
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
        ]);
        this.view = new EditorView({
            doc: file.rootState.val.doc,
            dispatch: (trs) => this.dispatch(trs),
            extensions: [
                oneDark,
                fixedHeightEditor,
                kmap,
                FileStatusField,

                this.wordWrapCompartment.of(EditorView.lineWrapping),
                this.languageCompartment.of([]),
                this.lspCompartment.of([]),
                lineNumbers(),
                highlightSpecialChars(),
                foldGutter(),
                lintGutter(),
                drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                rectangularSelection(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                highlightSelectionMatches(),
                indentUnit.of("    "),
            ],
        });

        van.derive(() => {
            LanguageDescription.matchFilename(languages, file.filePath.val)
                ?.load()
                .then((Lang) => {
                    const eff = this.languageCompartment.reconfigure(Lang);
                    this.view.dispatch({ effects: [eff] });
                });
        });

        // Load LSP extension for this file path if possible. This is optional
        // and fails silently if the lsp client or server is not available.
        van.derive(() => {
            const p = file.filePath.val;
            // Kick off async creation, then reconfigure compartment when ready
            createLspExtension(p).then((ext: Extension) => {
                try {
                    const eff = this.lspCompartment.reconfigure(ext);
                    this.view.dispatch({ effects: [eff] });
                } catch (err) {
                    console.warn("Failed to apply LSP extension:", err);
                }
            });
        });

        van.derive(() => {
            const effects = FileStatusEffect.of(
                file.diskDiscrepancyMessage.val,
            );
            const tr = this.view.state.update({ effects });
            this.dispatch(tr, true);
        });
    }

    get dom() {
        return this.view.dom;
    }

    focus() {
        this.view.dom.scrollIntoView({ behavior: "smooth" });
        this.view.focus();
    }

    title(): string {
        return this.file.filePath.val + (this.file.isDirty() ? "*" : "");
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
}
