// import "./pico.jade.css";
import "./index.css";

import van from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { Editor } from "./editor";
import { FolderTreeView } from "./foldernav";
import { EditorGrid, addEditor } from "./editorgrid";
import * as u from "./utils";

van.add(document.querySelector("aside nav"), FolderTreeView);
van.add(document.getElementById("editorGrid"), EditorGrid);

document.getElementById("addEditor")?.addEventListener("click", addEditor);
addEditor();
