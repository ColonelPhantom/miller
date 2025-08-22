import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

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

export class Editor {
    view: EditorView;

    constructor() {
        this.view = new EditorView({
            doc: "Start document",
            extensions: [basicSetup, oneDark, fixedHeightEditor],
        });
    }

    get dom() {
        return this.view.dom;
    }
}
