import {
    EditorState,
    EditorStateConfig,
    TransactionSpec,
    StateEffect,
    Text,
    Transaction,
} from "@codemirror/state";
import { history } from "@codemirror/commands";
import { Editor } from "./editor";
import van, { State } from "vanjs-core";
import { WorkspaceFile } from "@codemirror/lsp-client";
import { inferLanguageFromPath } from "./lsp";
import { EditorView } from "@codemirror/view";

// export const openFiles: { [path: string]: OpenFile } = {};
export const openFiles: Map<string, OpenFile> = new Map();

export class OpenFile implements WorkspaceFile {
    // Helper: find an open file instance by path
    static findOpenFile(path?: string): OpenFile | undefined {
        if (!path) return undefined;
        return openFiles.get(path);
    }
    filePath: State<string>;
    editors: Editor[];
    rootState: State<EditorState>;
    lastSaved: State<Text>;
    expectedDiskContent: State<string | null>;
    knownDiskContent: State<string | null>;
    diskDiscrepancyMessage: State<string | null>;

    constructor(cfg: EditorStateConfig) {
        this.filePath = van.state(null);
        this.editors = [];
        this.rootState = van.state(
            EditorState.create(cfg).update({
                effects: [StateEffect.appendConfig.of([history()])],
            }).state,
        );
        this.lastSaved = van.state(this.rootState.val.doc);
        this.expectedDiskContent = van.state(null);
        this.knownDiskContent = van.state(null);

        // LSP version counter: starts at 1 when document is first created/opened
        this.version = 1;

        this.diskDiscrepancyMessage = van.derive(() => {
            const expected = this.expectedDiskContent.val;
            const known = this.knownDiskContent.val;
            if (known === null) {
                return "File has been removed from disk.";
            } else if (expected === null) {
                return "File has been created on disk.";
            } else if (expected !== known) {
                return "File has been changed on disk.";
            }
            return null;
        });
    }

    static async openFile(filePath?: string): Promise<OpenFile> {
        if (filePath && openFiles.has(filePath)) {
            return openFiles.get(filePath)!;
        }
        const { content, path } = await window.electronAPI.readFile(filePath);
        const file = new OpenFile({ doc: content });
        file.expectedDiskContent.val = content;
        file.knownDiskContent.val = content;
        file.setPath(path);
        return file;
    }

    private setPath(path: string) {
        if (this.filePath.val) {
            openFiles.delete(this.filePath.val);
        }
        this.filePath.val = path;
        openFiles.set(path, this);
        // TODO: what if openFiles[path] already exists?
    }

    async saveFile() {
        if (this.filePath.val) {
            const doc = this.rootState.val.doc.toString();
            await window.electronAPI.saveFile(doc, this.filePath.val);
            this.lastSaved.val = this.rootState.val.doc;
            this.expectedDiskContent.val = doc;
        } else {
            await this.saveAs();
        }
    }

    async saveAs(filePath?: string) {
        const doc = this.rootState.val.doc.toString();
        const { path } = await window.electronAPI.saveFile(doc, filePath);
        this.setPath(path);
        this.lastSaved.val = this.rootState.val.doc;
        this.expectedDiskContent.val = doc;
    }

    // Function to create and return a new EditorView for this file
    createEditor(): Editor {
        const editor = new Editor(this);
        this.editors.push(editor);
        return editor;
    }

    // Function to remove an editor and clean up if no more editors exist
    async removeEditor(editor: Editor, callback: () => void) {
        const index = this.editors.indexOf(editor);
        if (index == -1) return;

        // If this is the last editor and the file is dirty, confirm before closing
        if (this.editors.length === 1 && this.isDirty()) {
            const confirmed = await this.confirmClose();
            if (!confirmed) {
                return;
            }
        }

        // Remove the editor from the list
        this.editors.splice(index, 1);
        editor.view.destroy();

        // If no more editors, remove from openFiles dictionary
        if (this.editors.length === 0) {
            openFiles.delete(this.filePath.val);
        }

        callback();
    }

    // Function to confirm closing of dirty file
    private async confirmClose(): Promise<boolean> {
        const fileName = this.filePath.val
            ? this.filePath.val.split("/").pop()
            : "untitled";
        // TODO: change message based on whether file exists on disk
        // e.g. if it was removed or changed
        const message = `Do you want to save the changes to ${fileName}?`;
        const result = await window.electronAPI.showConfirmDialog(
            message,
            "Save Changes?",
            ["Save", "Don't Save", "Cancel"],
        );

        if (result === "Save") {
            await this.saveFile();
            return true;
        } else if (result === "Don't Save") {
            return true;
        } else {
            return false;
        }
    }

    dispatch(trs: TransactionSpec, origin?: Editor) {
        const transaction = this.rootState.val.update(trs);
        this.rootState.val = transaction.state;

        // If the transaction introduced document changes, increment version
        if (transaction.changes && !transaction.changes.empty) {
            this.version = (this.version || 0) + 1;
            // TODO: call LSP didChange notification helper here
        }

        if (origin) {
            const es = this.editors.filter((e) => e !== origin);
            es.forEach((e) => e.dispatch(e.view.state.update(trs), true));
        } else {
            this.editors.forEach((e) => {
                const changes = transaction.changes;
                const userEvent = transaction.annotation(Transaction.userEvent);
                const annotations = userEvent
                    ? [Transaction.userEvent.of(userEvent)]
                    : [];
                e.dispatch(e.view.state.update({ changes, annotations }), true);
            });
        }
    }

    get target() {
        return {
            state: this.rootState.val,
            dispatch: (tr: TransactionSpec) => this.dispatch(tr),
        };
    }

    isDirty(): boolean {
        return !this.lastSaved.val.eq(this.rootState.val.doc);
    }

    // LSP stuff
    version: number;
    get uri(): string | null {
        if (!this.filePath.val) return null;
        return `file://${this.filePath.val}`;
    }
    get languageId(): string {
        return inferLanguageFromPath(this.filePath.val || "") || "";
    }
    get doc(): Text {
        return this.rootState.val.doc;
    }
    // Return an EditorView to be used by the LSP Workspace for position mapping.
    // If `main` is provided and belongs to this open file, return it. Otherwise
    // return the first available editor view, or null if none exist.
    getView(main?: EditorView): EditorView | null {
        if (main) {
            const found = this.editors.find((e) => e.view === main);
            if (found) return main;
        }
        if (this.editors.length > 0) return this.editors[0].view;
        return null;
    }
}
