import van from "vanjs-core";
const v = van.tags;
import type { FolderTree } from "../types/global";

const folderTreeState = van.state<FolderTree | null>(null);

async function openFolder() {
    const folderTree = await window.electronAPI.openFolder().catch(alert);
    if (!folderTree) return;
    folderTreeState.val = folderTree;
}

const FolderTreeView = () => {
    if (!folderTreeState.val) {
        return v.div(
            { style: "text-align: center; margin-top: 25px;" },
            v.p("No folder selected!"),
            v.button({ onclick: openFolder }, "Open Folder"),
        );
    }
    return v.div(
        v.span(
            { style: "font-weight: bold; margin-right: 1em;" },
            folderTreeState.val?.name ?? "No folder",
        ),
        v.button(
            {
                onclick: openFolder,
                title: "Refresh current folder",
                style: "margin-right: 0.5em;",
            },
            "⟳",
        ),
        v.button(
            {
                onclick: openFolder,
                title: "Open another folder",
                style: "margin-right: 0.5em;",
            },
            "📁",
        ),
        folderTreeState.val.children?.map(FsItemView) || [],
    );
};

// TODO: determine if lazy DOM creation is better or not.
// Alternatively, investigate lazy FS traversal in main.
const FsItemView = (tree: FolderTree): HTMLElement => {
    if (tree.type === "file") return v.p(tree.name);
    const isOpen = van.state(false);
    const children = () =>
        isOpen.val
            ? v.div(tree.children?.map(FsItemView))
            : v.div({ ariaBusy: true });
    const folder = v.details(
        { ontoggle: () => (isOpen.val = folder.open) },
        v.summary(tree.name),
        children,
    );

    return folder;
};

// Mount the folder tree view to the nav
van.add(document.querySelector("aside nav"), FolderTreeView);
