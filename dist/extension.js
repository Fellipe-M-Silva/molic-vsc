"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("molic.preview", () => {
      MoLICPanel.createOrShow(context.extensionUri);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("molic.export", () => {
      MoLICPanel.currentPanel?.export();
    })
  );
}
var MoLICPanel = class _MoLICPanel {
  static currentPanel;
  _panel;
  _extensionUri;
  _updateTimeout;
  _disposables = [];
  constructor(panel, extensionUri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "ready") {
          this._update();
        }
      },
      null,
      this._disposables
    );
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document === vscode.window.activeTextEditor?.document) {
          if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
          }
          this._updateTimeout = setTimeout(() => this._update(), 300);
        }
      },
      null,
      this._disposables
    );
    vscode.window.onDidChangeActiveTextEditor(
      () => this._update(),
      null,
      this._disposables
    );
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "saveFile":
            const uri = await vscode.window.showSaveDialog({
              filters: { Images: ["svg"] },
              defaultUri: vscode.Uri.file("diagrama-molic.svg")
            });
            if (uri) {
              const encoder = new TextEncoder();
              const data = encoder.encode(message.text);
              await vscode.workspace.fs.writeFile(uri, data);
              vscode.window.showInformationMessage(
                "Diagrama exportado com sucesso!"
              );
            }
            return;
        }
      },
      null,
      this._disposables
    );
  }
  static createOrShow(extensionUri) {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (_MoLICPanel.currentPanel) {
      _MoLICPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "molicView",
      "MoLIC Preview",
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")]
      }
    );
    _MoLICPanel.currentPanel = new _MoLICPanel(panel, extensionUri);
  }
  _update() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this._panel.visible) {
      return;
    }
    this._panel.webview.postMessage({
      command: "render",
      text: editor.document.getText()
    });
  }
  _getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js")
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline';">
        <style>
          body { 
						font-family: sans-serif; 
						padding: 20px; 
						color: var(--vscode-editor-foreground); 
						background-color: var(--vscode-editor-background); 
						overflow: hidden;
						/* Impede a sele\xE7\xE3o de texto em toda a webview */
						user-select: none;
						-webkit-user-select: none; /* Para compatibilidade com o motor do VS Code */
					}
					#app { 
						width: 100%; 
						height: 90vh; 
						overflow: auto; 
						margin-top: 40px; 
					}
					#export-btn { 
						position: fixed; top: 10px; right: 10px; z-index: 100; 
						padding: 5px 12px; cursor: pointer;
						background: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
						border: none; border-radius: 2px;
					}
					#export-btn:hover { background: var(--vscode-button-hoverBackground); }
					svg { max-width: 100%; height: auto; shape-rendering: geometricPrecision; }
        </style>
    </head>
    <body>
        <button id="export-btn">Exportar SVG</button>
        <div id="app">Aguardando c\xF3digo MoLIC...</div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
  dispose() {
    _MoLICPanel.currentPanel = void 0;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
  export() {
    this._panel.webview.postMessage({ command: "export" });
  }
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
//# sourceMappingURL=extension.js.map
