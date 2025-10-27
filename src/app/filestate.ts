import {
    EditorState,
    EditorStateConfig,
    TransactionSpec,
    StateEffect,
    Text,
} from "@codemirror/state";
import { history } from "@codemirror/commands";
import { Editor } from "./editor";

const openFiles: { [path: string]: OpenFile } = {};

export class OpenFile {
    filePath: string;
    editors: Editor[];
    rootState: EditorState;
    lastSaved?: Text;

    constructor(cfg: EditorStateConfig) {
        this.filePath = null;
        this.editors = [];
        this.rootState = EditorState.create(cfg).update({
            effects: [StateEffect.appendConfig.of([history()])],
        }).state;
    }

    static async openFile(filePath?: string): Promise<OpenFile> {
        if (filePath && openFiles[filePath]) {
            return openFiles[filePath];
        }
        const { content, path } = await window.electronAPI.readFile(filePath);
        const file = new OpenFile({ doc: content });
        file.lastSaved = file.rootState.doc;
        file.setPath(path);
        return file;
    }

    private setPath(path: string) {
        delete openFiles[this.filePath];
        this.filePath = path;
        openFiles[path] = this;
    }

    async saveFile() {
        if (this.filePath) {
            await window.electronAPI.saveFile(
                this.rootState.doc.toString(),
                this.filePath,
            );
            this.lastSaved = this.rootState.doc;
        } else {
            await this.saveAs();
        }
    }

    async saveAs(filePath?: string) {
        const { path } = await window.electronAPI.saveFile(
            this.rootState.doc.toString(),
            filePath,
        );
        this.setPath(path);
        this.lastSaved = this.rootState.doc;
    }

    // Function to create and return a new EditorView for this file
    createEditor(): Editor {
        const editor = new Editor(this);
        this.editors.push(editor);
        return editor;
    }

    dispatch(trs: TransactionSpec, origin?: Editor) {
        this.rootState = this.rootState.update(trs).state;
        if (origin) {
            const es = this.editors.filter((e) => e !== origin);
            es.forEach((e) => e.dispatch(e.view.state.update(trs), true));
        } else {
            this.editors.forEach((e) =>
                e.dispatch(e.view.state.update(trs), true),
            );
        }
    }

    get target() {
        console.log("Getting target");
        return {
            state: this.rootState,
            dispatch: (tr: TransactionSpec) => this.dispatch(tr),
        };
    }

    isDirty(): boolean {
        return this.lastSaved !== this.rootState.doc;
    }
}
