import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("molic.preview", () => {
			MoLICPanel.createOrShow(context.extensionUri);
		}),
	);
}

class MoLICPanel {
	public static currentPanel: MoLICPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _updateTimeout: NodeJS.Timeout | undefined;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		this._update();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		vscode.workspace.onDidChangeTextDocument(
			(e) => {
				if (e.document === vscode.window.activeTextEditor?.document) {
					if (this._updateTimeout) {
						clearTimeout(this._updateTimeout);
					}

					this._updateTimeout = setTimeout(() => {
						this._update();
					}, 300);
				}
			},
			null,
			this._disposables,
		);

		vscode.window.onDidChangeActiveTextEditor(
			() => {
				this._update();
			},
			null,
			this._disposables,
		);
	}

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (MoLICPanel.currentPanel) {
			MoLICPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			"molicView",
			"MoLIC Preview",
			column || vscode.ViewColumn.Two,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
			},
		);

		MoLICPanel.currentPanel = new MoLICPanel(panel, extensionUri);
	}

	private _update() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

		this._panel.webview.postMessage({
			command: "render",
			text: editor.document.getText(),
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js"),
		);
		const nonce = getNonce();

		return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline';">
        <style>
            body { font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
            #app { width: 100%; height: 100vh; }
        </style>
    </head>
    <body>
        <div id="app">Aguardando código MoLIC...</div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
	}

	public dispose() {
		MoLICPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
