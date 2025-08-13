import van from "vanjs-core";
const v = van.tags;
import type { FolderTree } from "../types/global";

const folderTreeState = van.state<FolderTree | null>(null);

async function openFolder() {
    const folderTree = await window.electronAPI.openFolder();
    if (!folderTree) return;
    folderTreeState.val = folderTree;
}

const FolderTreeView = () => {
    if (!folderTreeState.val) {
        return v.div(
            { style: "text-align: center; margin-top: 25px;" },
            v.p("No folder selected!"),
            v.p(
                v.button(
                    {
                        onclick: async () => {
                            const folderTree =
                                await window.electronAPI.openFolder();
                            if (!folderTree) return;
                            folderTreeState.val = folderTree;
                        },
                    },
                    "Open Folder",
                ),
            ),
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

const FsItemView = (tree: FolderTree): HTMLElement | string => {
    if (tree.type === "file") return v.p(tree.name);
    return v.details(v.summary(tree.name), tree.children?.map(FsItemView));

    // if (tree.type === "file") return v.div(" ", tree.name);
    // // Use a state to track open/close instead of <details>
    // const isOpen = van.state(0);
    // return v.div(
    //     {
    //         style: "cursor: pointer; user-select: none; font-weight: bold;",
    //         onclick: () => isOpen.val++,
    //     },
    //     () => (isOpen.val ? "▼ " : "▶ "),
    //     tree.name,
    // );
    // // return v.div(
    // //     v.span(
    // //         {
    // //             style: "cursor: pointer; user-select: none; font-weight: bold;",
    // //             onclick: () => {
    // //                 console.log("opening");
    // //                 isOpen.val++;
    // //             },
    // //         },
    // //         () => (isOpen.val ? "▼ " : "▶ "),
    // //         tree.name,
    // //     ),
    // //     " ",
    // //     isOpen.val,
    // // );
};

// Mount the folder tree view reactively to the nav
const nav = document.querySelector("aside nav");
if (nav) {
    van.add(nav, () => FolderTreeView());
}
