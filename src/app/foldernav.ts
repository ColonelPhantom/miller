import van from "vanjs-core";
const v = van.tags;
import type { FolderTree } from "../types/global";
import { addEditor } from "./editorgrid";
import { OpenFile } from "./filestate";

import * as u from "./utils";

const folderTreeState = van.state<FolderTree | null>(null);

async function openFolder() {
    const folderTree = await window.electronAPI.openFolder().catch(alert);
    if (!folderTree) return;
    folderTreeState.val = folderTree;
}

export const FolderTreeView = () => {
    if (!folderTreeState.val) {
        return v.div(
            { class: "text-center m-4" },
            v.p("No folder selected!"),
            u.Button(openFolder, "Open Folder"),
        );
    }
    return v.div(
        { class: "mx-1" },
        v.div(
            { class: "flex w-full" },
            v.span(
                { class: "font-bold flex-1" },
                folderTreeState.val?.name ?? "No folder",
            ),
            u.InlineButton(openFolder, "Refresh current folder", "⟳"),
            u.InlineButton(openFolder, "Open another folder", "📁"),
        ),
        folderTreeState.val.children?.map(FsItemView) || [],
    );
};

// TODO: determine if lazy DOM creation is better or not.
// Alternatively, investigate lazy FS traversal in main.
const FsItemView = (tree: FolderTree): HTMLElement => {
    if (tree.type === "file")
        return v.p(
            {
                class: "cursor-pointer hover:bg-gray-100",
                onclick: async () =>
                    addEditor(await OpenFile.openFile(tree.path)),
            },
            v.span("📄"),
            tree.name,
        );
    const isOpen = van.state(false);
    const children = () =>
        isOpen.val
            ? v.ul({}, tree.children?.map(FsItemView))
            : v.div({ ariaBusy: true });
    const folder = v.details(
        {
            class: "flex-auto inline",
            ontoggle: () => (isOpen.val = folder.open),
        },
        v.summary(tree.name),
        children,
    );

    return v.div(
        { class: "cursor-pointer flex hover:bg-gray-100" },
        v.span(() => (isOpen.val ? "📂" : "📁")),
        folder,
    );
};
