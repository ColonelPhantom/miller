import van from "vanjs-core";
const v = van.tags;

document.getElementById("openFolder").addEventListener("click", async () => {
    const folderPath = await window.electronAPI.openFolder();
    document.getElementById("currentFolder").innerText = folderPath;
});
