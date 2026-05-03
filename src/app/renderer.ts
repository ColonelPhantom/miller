// import "./pico.jade.css";
import "./index.css";

import van from "vanjs-core";
const v = van.tags;

import { FolderTreeView } from "./foldernav";
import { EditorTabs, addTab, addEditor } from "./editorgrid";
import { QuickOpen } from "./quickopen";
import * as u from "./utils";
import { OpenFile } from "./filestate";

function newFile() {
    const file = new OpenFile({});
    addEditor(file);
}

const app = v.div(
    { class: "h-screen max-h-screen w-screen max-w-screen flex" },
    v.aside(
        {
            class: "flex-none resize-x overflow-x-hidden overflow-y-scroll w-3xs min-w-32",
        },
        u.InlineButton(addTab, "Add Tab", "+Tab"),
        u.InlineButton(newFile, "Add Editor", "+File"),
        FolderTreeView,
    ),
    EditorTabs,
    QuickOpen.dom,
);

van.add(document.body, app);
