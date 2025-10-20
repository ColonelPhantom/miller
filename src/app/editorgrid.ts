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

const editors = vanX.reactive([[]]);
const currentTab = van.state(0);
van.derive(() => console.log("Setting tab to", currentTab.val));

export function addEditor() {
    console.log("Adding editor to tab ", currentTab.val, editors);
    editors[currentTab.val].push(vanX.noreactive(new Editor()));
}
export function addTab() {
    editors.push([]);
}

const TabHeader = (tab: any, del: any, k: any) =>
    v.div(
        {
            class: () =>
                `flex-auto flex ${currentTab.val === k ? "bg-green-500" : ""}`,
            onclick: () => (currentTab.val = k),
        },
        v.span({ class: "mx-1 flex-1" }, "Tab " + k),
        u.InlineButton(del, "Close", "❌"),
    );
const EditorGrid = (tab: any, del: any, k: any) => {
    console.log("Rendering", tab.val, "with key", k);
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
