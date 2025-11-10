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

const openFiles: { [path: string]: OpenFile } = {};

export class OpenFile {
    filePath: State<string>;
    editors: Editor[];
    rootState: State<EditorState>;
    lastSaved?: State<Text>;

    constructor(cfg: EditorStateConfig) {
        this.filePath = van.state(null);
        this.editors = [];
        this.rootState = van.state(
            EditorState.create(cfg).update({
                effects: [StateEffect.appendConfig.of([history()])],
            }).state,
        );
    }

    static async openFile(filePath?: string): Promise<OpenFile> {
        if (filePath && openFiles[filePath]) {
            return openFiles[filePath];
        }
        const { content, path } = await window.electronAPI.readFile(filePath);
        const file = new OpenFile({ doc: content });
        file.lastSaved = van.state(file.rootState.val.doc);
        file.setPath(path);
        return file;
    }

    private setPath(path: string) {
        delete openFiles[this.filePath?.val];
        this.filePath.val = path;
        openFiles[path] = this;
    }

    async saveFile() {
        if (this.filePath) {
            await window.electronAPI.saveFile(
                this.rootState.val.doc.toString(),
                this.filePath.val,
            );
            this.lastSaved.val = this.rootState.val.doc;
        } else {
            await this.saveAs();
        }
    }

    async saveAs(filePath?: string) {
        const { path } = await window.electronAPI.saveFile(
            this.rootState.val.doc.toString(),
            filePath,
        );
        this.setPath(path);
        this.lastSaved.val = this.rootState.val.doc;
    }

    // Function to create and return a new EditorView for this file
    createEditor(): Editor {
        const editor = new Editor(this);
        this.editors.push(editor);
        return editor;
    }

    dispatch(trs: TransactionSpec, origin?: Editor) {
        const transaction = this.rootState.val.update(trs);
        this.rootState.val = transaction.state;
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
        console.log("Getting target");
        return {
            state: this.rootState.val,
            dispatch: (tr: TransactionSpec) => this.dispatch(tr),
        };
    }

    isDirty(): boolean {
        return !this.lastSaved.val.eq(this.rootState.val.doc);
    }
}
