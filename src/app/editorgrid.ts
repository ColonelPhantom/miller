import van, { State } from "vanjs-core";
import * as vanX from "vanjs-ext";
const v = van.tags;

import { OpenFile } from "./filestate";
import * as u from "./utils";
import { Editor } from "./editor";
import { Terminal } from "./terminal";
import { Displayable } from "./displayable";

const EditorWrapper = (
    editor: State<Displayable>,
    del: () => void,
    k: number,
) => {
    // Set the delete function on the editor when it's created
    van.derive(() => {
        if (!editor || !editor.val) return;

        const findLeft = () => {
            const list = editors[currentTab.val] || [];
            for (let i = k - 1; i >= 0; i--) {
                const c = list[i];
                if (c) {
                    return c;
                }
            }
            return null;
        };

        const findRight = () => {
            const list = editors[currentTab.val] || [];
            for (let i = k + 1; i < list.length; i++) {
                const c = list[i];
                if (c) {
                    return c;
                }
            }
            return null;
        };

        const wrappedDelete = () => {
            // Find nearest non-empty neighbor (scan left then right)
            let neighborState: Displayable | null = findLeft();
            if (!neighborState) {
                neighborState = findRight();
            }

            // Call the original delete function which updates the reactive list / DOM
            del();

            // After reactive update, focus the neighbor if available
            if (neighborState) {
                neighborState.focus();
            }
        };

        editor.val.addShortcut("Alt-[", () => findLeft()?.focus());
        editor.val.addShortcut("Alt-]", () => findRight()?.focus());
        editor.val.setDeleteFunction(wrappedDelete);
    });

    return v.div(
        { class: "flex flex-col group" },
        v.div(
            {
                class: "flex group-focus-within:bg-blue-300 dark:group-focus-within:bg-blue-900",
            },
            v.span({ class: "mx-1 flex-1" }, () => editor.val.title()),
            u.InlineButton(() => editor.val.close(), "Close", "❌"),
        ),
        v.div({ class: "flex-auto h-4" }, editor.val.dom),
    );
};

// give type to editors
const editors: Displayable[][] = vanX.reactive([[]]);
const currentTab = van.state(0);

export function addEditor(file: OpenFile) {
    const editor = file.createEditor();
    editors[currentTab.val].push(vanX.noreactive(editor));
    editor.focus();
}

export function addTab() {
    editors.push([]);
}

export function addTerminal() {
    const term = new Terminal();
    editors[currentTab.val].push(vanX.noreactive(term));
    term.focus();
    setTimeout(() => {
        term.focus();
    }, 0);
}

const TabHeader = (tab: State<Editor[]>, del: () => void, k: number) =>
    v.div(
        {
            class: () =>
                `flex-auto flex ${currentTab.val === k ? "bg-green-500 dark:bg-green-700" : ""}`,
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

function shortcutHandler(e: KeyboardEvent) {
    if (e.key === "t" && e.altKey) {
        if (e.type === "keydown") {
            addTerminal();
        }
        e.preventDefault();
    }
}

document.addEventListener("keyup", shortcutHandler, { capture: true });
document.addEventListener("keydown", shortcutHandler, { capture: true });
