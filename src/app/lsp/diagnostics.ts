import * as lsp from "vscode-languageserver-protocol";
import { StateField, StateEffect } from "@codemirror/state";
import { showPanel, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { LSPPlugin, LSPClientExtension } from "@codemirror/lsp-client";
import { OpenFile } from "../filestate";
import { Text } from "@codemirror/state";
import { applyWorkspaceEdit } from "../lsp";

import van from "vanjs-core";
const v = van.tags;

type CodeAction = (lsp.CodeAction | lsp.Command);

const setCodeActions = StateEffect.define<CodeAction[]>();

const codeActionState = StateField.define<CodeAction[]>({
    create: () => null,
    update(value, tr) {
        for (let e of tr.effects) {
            if (e.is(setCodeActions)) value = e.value;
        }
        return value;
    },
    provide: f => showPanel.from(f, ca => ca ? createCodeActionPanel : null),
});

function createCodeActionPanel(view: EditorView) {
    const plugin = LSPPlugin.get(view);
    const actions = view.state.field(codeActionState);
    const mapping = plugin.client.workspaceMapping();
    // TODO cleanup mapping when done
    // TODO use codemirror/view.showDialog instead
    const list = v.ul(actions.map(a => {
        if (!Object.hasOwn(a, "edit")) return null;
        const action = a as lsp.CodeAction;
        // TODO action resolving
        const onclick = () => {
            applyWorkspaceEdit(mapping, plugin.client.workspace, action.edit, "codeaction");
            view.dispatch({effects: setCodeActions.of(null)});
        }
        return v.li(v.a({onclick}, action.title));
    }));
    const closeBtn = v.button({
        class: "absolute top-0 right-5",
        type: "button",
        name: "close",
        "aria-label": view.state.phrase("close"),
        onclick: () => view.dispatch({effects: setCodeActions.of(null)}),
    }, "×");
    const dom = v.div(list, closeBtn);
    return { top: false, dom };
}

function toSeverity(sev: lsp.DiagnosticSeverity) {
    return sev == 1
        ? "error"
        : sev == 2
            ? "warning"
            : sev == 3
                ? "info"
                : "hint";
}

const autoSync = ViewPlugin.fromClass(
    class {
        pending: any | null = null;
        update(update: ViewUpdate) {
            if (update.docChanged) {
                if (this.pending != null) clearTimeout(this.pending);
                this.pending = setTimeout(() => {
                    this.pending = null;
                    const plugin = LSPPlugin.get(update.view);
                    if (plugin) plugin.client.sync();
                }, 500);
            }
        }
        destroy() {
            if (this.pending != null) clearTimeout(this.pending);
        }
    },
);

function fromPosition(doc: Text, pos: lsp.Position): number {
    const line = doc.line(pos.line + 1);
    return line.from + pos.character;
}

function fetchCodeActionsForDiagnostic(plugin: LSPPlugin, diag: lsp.Diagnostic): Promise<CodeAction[]> {
    const hasCap = plugin.client.serverCapabilities ? !!plugin.client.serverCapabilities["codeActionProvider"] : null;
    if (hasCap === false) return Promise.resolve(null);
    const params: lsp.CodeActionParams = {
        textDocument: { uri: plugin.uri },
        range: diag.range,
        context: {
            diagnostics: [diag], // TODO multiple?
            triggerKind: lsp.CodeActionTriggerKind.Invoked,
        }
    }
    return plugin.client.request<
        lsp.CodeActionParams,
        (lsp.Command | lsp.CodeAction)[]
    >(
        "textDocument/codeAction",
        params
    );
}

export function serverDiagnostics(): LSPClientExtension {
    return {
        clientCapabilities: {
            textDocument: { publishDiagnostics: { versionSupport: true } },
        },
        notificationHandlers: {
            "textDocument/publishDiagnostics": (
                client,
                params: lsp.PublishDiagnosticsParams,
            ) => {
                const file = client.workspace.getFile(params.uri) as OpenFile;
                if (!file) {
                    return false;
                }
                if (params.version != null && params.version != file.version) {
                    return false;
                }

                file.setDiagnostics(
                    params.diagnostics.map((item) => ({
                        from: file.changes.mapPos(
                            fromPosition(file.doc, item.range.start),
                        ),
                        to: file.changes.mapPos(
                            fromPosition(file.doc, item.range.end),
                        ),
                        severity: toSeverity(item.severity ?? 1),
                        message: item.message,
                        actions: [{
                            name: "Solve",
                            apply: async (view) => {
                                const plugin = LSPPlugin.get(view);
                                const a = await fetchCodeActionsForDiagnostic(plugin, item);
                                const effects = setCodeActions.of(a);
                                view.dispatch({ effects });
                            },
                        }]
                    })),
                );
                return true;
            },
        },
        editorExtension: [autoSync, codeActionState],
    };
}
