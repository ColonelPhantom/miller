import van from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { Editor } from "./editor";
import * as u from "./utils";

const EditorWrapper = (editor: any, del: any, k: any) =>
    v.div(
        { class: "flex flex-col" },
        v.div(
            { class: "flex" },
            v.span({ class: "mx-1 flex-1" }, "Editor " + k),
            u.InlineButton(del, "Close", "❌"),
        ),
        v.div({ class: "flex-auto h-4" }, editor.val.dom),
    );

const editors = vanX.reactive([]);

export function addEditor() {
    editors.push(vanX.noreactive(new Editor()));
}

export const EditorGrid = v.main({
    class: "flex flex-auto gap-4 overflow-x-auto",
});
vanX.list(EditorGrid, editors, EditorWrapper);

// const grid = v.main({
//     class: "flex flex-auto gap-4 overflow-x-auto",
// });
// export const EditorGrid = vanX.list(grid, editors, EditorWrapper);
// vanX.list(document.getElementById("editorGrid"), editors, EditorWrapper);
// van.add(document.getElementById("editorGrid"), EditorGrid);
