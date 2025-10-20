// import "./pico.jade.css";
import "./index.css";

import van from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { Editor } from "./editor";
import { FolderTreeView } from "./foldernav";
import { EditorTabs, addTab, addEditor } from "./editorgrid";
import * as u from "./utils";

const app = v.div(
    { class: "h-screen max-h-screen w-screen max-w-screen flex" },
    v.aside(
        {
            class: "flex-none resize-x overflow-x-hidden overflow-y-scroll w-3xs min-w-32",
        },
        u.InlineButton(addTab, "Add Tab", "+Tab"),
        u.InlineButton(addEditor, "Add Editor", "+File"),
        FolderTreeView,
    ),
    EditorTabs,
);

van.add(document.body, app);

addEditor();
