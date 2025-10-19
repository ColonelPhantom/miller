// import "./pico.jade.css";
import "./index.css";

import van from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { Editor } from "./editor";
import { FolderTreeView } from "./foldernav";
import { EditorGrid, addEditor } from "./editorgrid";
import * as u from "./utils";

const app = v.div(
    { class: "h-screen max-h-screen flex flex-col" },
    v.header(
        { class: "flex-none" },
        v.button({ id: "addEditor", onclick: addEditor }, "Add Editor"),
    ),
    v.div(
        { id: "content", class: "flex flex-1 min-h-0" },
        v.aside(
            {
                class: "flex-none resize-x overflow-x-hidden overflow-y-scroll w-3xs min-w-32",
            },
            FolderTreeView,
        ),
        EditorGrid,
    ),
);

van.add(document.body, app);

addEditor();
