import van, { State } from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { OpenFile } from "./filestate";
import * as u from "./utils";
import { Editor } from "./editor";
import { Terminal } from "./terminal";

export interface Displayable {
    setDeleteFunction(del: () => void): void;
    title(): string;
    close(): void;
    dom: HTMLElement;
}

const EditorWrapper = (
    editor: State<Displayable>,
    del: () => void,
    k: number,
) => {
    // Set the delete function on the editor when it's created
    van.derive(() => {
        if (editor.val) {
            editor.val.setDeleteFunction(del);
        }
    });

    return v.div(
        { class: "flex flex-col" },
        v.div(
            { class: "flex" },
            v.span({ class: "mx-1 flex-1" }, () => editor.val.title()),
            u.InlineButton(() => editor.val.close(), "Close", "❌"),
        ),
        v.div({ class: "flex-auto h-4" }, editor.val.dom),
    );
};

const editors = vanX.reactive([[]]);
const currentTab = van.state(0);

export function addEditor(file: OpenFile) {
    const editor = file.createEditor();
    editors[currentTab.val].push(vanX.noreactive(editor));
    editor.focus();
}

export function addTab(file?: OpenFile) {
    editors.push(file ? [file] : []);
}

export function addTerminal() {
    const term = new Terminal();
    editors[currentTab.val].push(vanX.noreactive(term));
    term.focus();
}

const TabHeader = (tab: State<Editor[]>, del: () => void, k: number) =>
    v.div(
        {
            class: () =>
                `flex-auto flex ${currentTab.val === k ? "bg-green-500" : ""}`,
            onclick: () => (currentTab.val = k),
        },
        v.span({ class: "mx-1 flex-1" }, "Tab " + k),
        u.InlineButton(del, "Close", "❌"),
    );

const EditorGrid = (tab: State<Editor[]>, del: () => void, k: number) => {
    const main = v.main({
        class: "flex flex-auto gap-4 overflow-x-auto min-width-4",
        hidden: () => k !== currentTab.val,
    });
    vanX.list(main, tab.val, EditorWrapper);
    return main;
};

const TabBar = v.div({ class: "flex-none flex" });

export const EditorTabs = v.div(
    {
        class: "flex flex-col flex-auto min-w-4",
    },
    TabBar,
);

vanX.list(TabBar, editors, TabHeader);
vanX.list(EditorTabs, editors, EditorGrid);

document.addEventListener("keyup", (e) => {
    if (e.key === "t" && e.altKey) {
        addTerminal();
    }
});
