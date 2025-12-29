import * as lsp from "vscode-languageserver-protocol";
import { StateEffect, StateField } from "@codemirror/state";
import { GutterMarker, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { LSPPlugin, LSPClientExtension } from "@codemirror/lsp-client";

type GutterCodeAction = {
    
}

const codeActionGutterMarker = new class extends GutterMarker {
    toDOM() { return document.createTextNode("💡"); }
};

const codeActionGutterEffect = StateEffect.define<lsp.CodeAction[]>();

const codeActionGutterState = StateField.define<lsp.CodeAction[]>({
    create() { return []; },
    update(updateCodeActions, tr) {
        for (let e of tr.effects) {
            if (e.is(codeActionGutterEffect)) {
                return e.value;
            }
        }
        return updateCodeActions;
    }
});

const syncCodeAction = ViewPlugin.fromClass(
    class {
        pending: any | null = null;
        update(update: ViewUpdate) {
            if (update.docChanged) {
                if (this.pending != null) clearTimeout(this.pending);
                this.pending = setTimeout(() => {
                    this.pending = null;
                    const plugin = LSPPlugin.get(update.view);
                    if (plugin) {
                        plugin.client.sync();
                        updateCodeActions(plugin);
                    }
                }, 500);
            }
        }
        destroy() {
            if (this.pending != null) clearTimeout(this.pending);
        }
    },
);

function updateCodeActions(plugin: LSPPlugin) {
    const hasCap = plugin.client.serverCapabilities ? !!plugin.client.serverCapabilities["codeActionProvider"] : null;
    if (hasCap === false) return Promise.resolve(null);
    const params: lsp.CodeActionParams = {
        textDocument: { uri: plugin.uri },
        range: {
            start: plugin.toPosition(0),
            end: plugin.toPosition(plugin.syncedDoc.length),
        },
        context: {
            diagnostics: [], // TODO fix
            triggerKind: lsp.CodeActionTriggerKind.Automatic,
        }
    }
    plugin.client.request<
        lsp.CodeActionParams,
        (lsp.Command | lsp.CodeAction)[]
    >(
        "textDocument/codeAction",
        params
    ).then((actions) => {
        const file = plugin.client.workspace.getFile(plugin.uri) as OpenFile;
        if (!file) return false;
        if ()
        
    });
}

export function codeAction(config: {}): LSPClientExtension {
    return {
        clientCapabilities: {
            codeAction: {
                dataSupport: true,
                resolveSupport: ["edit"],
            }
        },
        editorExtension: syncCodeAction,
    }
}