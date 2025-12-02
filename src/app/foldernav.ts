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

// Refresh the current folder tree from main (re-open)
let refreshScheduled = false;
async function refreshFolder() {
    refreshScheduled = false;
    const folderTree = await window.electronAPI.getWorkspaceTree().catch(alert);
    if (!folderTree) return;
    folderTreeState.val = folderTree;
}

// Subscribe to filesystem events and refresh tree when directories change
window.electronAPI.onFsEvent(async (ev: { event: string; path: string }) => {
    // If no workspace is loaded ignore
    if (!folderTreeState.val) return;
    const workspaceRoot = folderTreeState.val.path;
    if (!ev.path.startsWith(workspaceRoot)) return;

    // For directory-level changes or create/unlink/rename, refresh the tree
    if (
        ev.event === "addDir" ||
        ev.event === "unlinkDir" ||
        ev.event === "add" ||
        ev.event === "unlink"
    ) {
        // Debounce-ish: schedule a refresh
        if (!refreshScheduled) {
            refreshScheduled = true;
            setTimeout(() => refreshFolder(), 50);
        }
    }

    // If a file changed on disk and it's open, show disk version panels
    if (ev.event === "change" || ev.event === "add" || ev.event === "unlink") {
        const openFile = OpenFile.findOpenFile(ev.path);
        if (!openFile) return;
        // Read latest contents from disk
        const data = await window.electronAPI
            .readFile(ev.path)
            .catch(() => null);
        if (!data) return;
        if (ev.event === "unlink") {
            openFile.knownDiskContent.val = null;
        } else {
            openFile.knownDiskContent.val = data.content;
        }
    }
});

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
            u.InlineButton(refreshFolder, "Refresh current folder", "⟳"),
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
                class: "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700",
                onclick: async () =>
                    addEditor(await OpenFile.openFile(tree.path)),
            },
            v.span("📄"),
            tree.name,
        );
    const isOpen = van.state(false);
    const children = () =>
        isOpen.val
            ? v.ul({ class: "pl-4" }, tree.children?.map(FsItemView))
            : v.div({ ariaBusy: true });
    const folder = v.details(
        {
            class: "flex-auto inline",
            ontoggle: () => (isOpen.val = folder.open),
        },
        v.summary(
            {
                class: "cursor-pointer flex hover:bg-gray-100 dark:hover:bg-gray-700",
            },
            v.span(() => (isOpen.val ? "📂" : "📁")),
            tree.name,
        ),
        children,
    );

    return folder;
};
