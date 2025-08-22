// import "./pico.jade.css";
import "./index.css";

import van from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { Editor } from "./editor";
import { FolderTreeView } from "./foldernav";
import * as u from "./utils";

const EditorWrapper = (editor: any, del: any, k: any) =>
    v.div(
        { class: "flex flex-col" },
        v.div(
            { class: "flex" },
            v.span({ class: "mx-1 flex-1" }, "Editor " + k),
            u.InlineButton(del, "Close", "❌"),
        ),
        v.div({ class: "h-full" }, editor.val.dom),
    );

// Create and mount editor list
const editors = vanX.reactive([]);
vanX.list(document.getElementById("editorGrid"), editors, EditorWrapper);

function addView() {
    editors.push(vanX.noreactive(new Editor()));
}

document.getElementById("addEditor")?.addEventListener("click", addView);

addView();

// Mount the folder tree view to the nav
van.add(document.querySelector("aside nav"), FolderTreeView);
