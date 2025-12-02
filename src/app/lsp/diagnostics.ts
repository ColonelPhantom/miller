import type * as lsp from "vscode-languageserver-protocol"
import {setDiagnostics} from "@codemirror/lint"
import {ViewPlugin, ViewUpdate} from "@codemirror/view"
import {LSPPlugin, LSPClientExtension} from "@codemirror/lsp-client"
import {OpenFile} from "../filestate"
import { Text } from "@codemirror/state"

function toSeverity(sev: lsp.DiagnosticSeverity) {
  return sev == 1 ? "error" : sev == 2 ? "warning" : sev == 3 ? "info" : "hint"
}

const autoSync = ViewPlugin.fromClass(class {
  pending: any | null = null
  update(update: ViewUpdate) {
    if (update.docChanged) {
      if (this.pending != null) clearTimeout(this.pending)
      this.pending = setTimeout(() => {
        this.pending = null
        let plugin = LSPPlugin.get(update.view)
        if (plugin) plugin.client.sync()
      }, 500)
    }
  }
  destroy() {
    if (this.pending != null) clearTimeout(this.pending)
  }
})

function fromPosition(doc: Text, pos: lsp.Position): number {
  let line = doc.line(pos.line + 1)
  return line.from + pos.character
}

export function serverDiagnostics(): LSPClientExtension {
  return {
    clientCapabilities: {textDocument: {publishDiagnostics: {versionSupport: true}}},
    notificationHandlers: {
      "textDocument/publishDiagnostics": (client, params: lsp.PublishDiagnosticsParams) => {
        let file = client.workspace.getFile(params.uri) as OpenFile;
        if (!file || params.version != null && params.version != file.version) return false;
        for(const view of file.editors.map(e => e.view)) {
          const mapPos = (p: number) => file.changes ? file.changes.mapPos(p) : p;
          file.setDiagnostics(params.diagnostics.map(item => ({
            from: mapPos(fromPosition(file.doc, item.range.start)),
            to: mapPos(fromPosition(file.doc, item.range.end)),
            severity: toSeverity(item.severity ?? 1),
            message: item.message,
          })));
        }
        return true
      }
    },
    editorExtension: autoSync
  }
}
