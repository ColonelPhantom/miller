import {
    EditorState,
    EditorStateConfig,
    TransactionSpec,
    StateEffect,
} from "@codemirror/state";
import { history } from "@codemirror/commands";
import { Editor } from "./editor";

const openFiles: { [path: string]: OpenFile } = {};

export class OpenFile {
    filePath: string;
    editors: Editor[];
    rootState: EditorState;

    constructor(cfg: EditorStateConfig) {
        this.filePath = null;
        this.editors = [];
        this.rootState = EditorState.create(cfg).update({
            effects: [StateEffect.appendConfig.of([history()])],
        }).state;
    }

    static async openFile(filePath?: string) {
        const { content, path } = await window.electronAPI.readFile(filePath);
        const file = new OpenFile({ doc: content });
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
    }

    // Function to create and return a new EditorView for this file
    createEditor(): Editor {
        const editor = new Editor(this);
        this.editors.push(editor);
        return editor;
    }

    dispatch(trs: TransactionSpec, origin?: Editor) {
        console.log("Dispatching trs", trs, "to", this.editors, "from", origin);
        console.log(this.rootState);
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
}
