import van, { State } from "vanjs-core";
import { OpenFile } from "./filestate";
import { addEditor } from "./editorgrid";
import { allFiles } from "./foldernav";

const v = van.tags;

export const QuickOpen = (() => {
    const isOpen = van.state(false);
    const query = van.state("");
    const files = van.state([]);
    const filteredFiles = van.derive(() => {
        if (!query.val) return files.val.slice(0, 100);
        return files.val.filter(f => f.toLowerCase().includes(query.val.toLowerCase())).slice(0, 100);
    });
    const selectedIndex = van.state(0);

    // Update selectedIndex when filteredFiles changes
    van.derive(() => {
        filteredFiles.val; // track dependency
        selectedIndex.val = 0;
    });

    const close = () => {
        isOpen.val = false;
        query.val = "";
        selectedIndex.val = 0;
    };

    const openSelectedFile = async () => {
        const path = filteredFiles.val[selectedIndex.val];
        if (path) {
            const file = await OpenFile.openFile(path);
            if (file) {
                addEditor(file);
            }
        }
        close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen.val) return;

        if (e.key === "Escape") {
            close();
            e.preventDefault();
        } else if (e.key === "Enter") {
            openSelectedFile();
            e.preventDefault();
        } else if (e.key === "ArrowDown") {
            selectedIndex.val = (selectedIndex.val + 1) % filteredFiles.val.length;
            e.preventDefault();
        } else if (e.key === "ArrowUp") {
            selectedIndex.val = (selectedIndex.val - 1 + filteredFiles.val.length) % filteredFiles.val.length;
            e.preventDefault();
        }
    };

    const open = async () => {
        query.val = "";
        files.val = allFiles.val;
        console.log("setting allfiles to ", allFiles.val);
        
        isOpen.val = true;
        // Focus the input after the DOM is updated
        setTimeout(() => {
            const input = document.getElementById("quick-open-input") as HTMLInputElement;
            input?.focus();
        }, 0);
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });

    const modal = v.div(
        {
            class: () => isOpen.val ? "fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black bg-opacity-50" : "hidden",
            onclick: (e: MouseEvent) => {
                if ((e.target as HTMLElement).id === "quick-open-overlay") {
                    close();
                }
            }
        },
        v.div(
            {
                id: "quick-open-overlay",
                class: "bg-white dark:bg-gray-800 w-1/2 max-w-2xl rounded shadow-lg overflow-hidden flex flex-col",
            },
            v.input(
                {
                    id: "quick-open-input",
                    class: "w-full p-4 text-lg border-b dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none",
                    placeholder: "Quick Open...",
                    value: query,
                    oninput: (e: any) => (query.val = e.target.value),
                },
            ),
            v.div(
                { class: "max-h-96 overflow-y-auto" },
                () => v.ul(
                    filteredFiles.val.map((path, i) => v.div(
                        {
                            class: () => `p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 ${selectedIndex.val === i ? "bg-blue-200 dark:bg-blue-800" : ""}`,
                            onclick: () => {
                                selectedIndex.val = filteredFiles.val.indexOf(path);
                                openSelectedFile();
                            },
                        },
                        path
                    )
                ))
            )
        )
    );

    return {
        dom: modal,
        open,
    };
})();
