import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("molic.preview", () => {
			MoLICPanel.createOrShow(context.extensionUri);
		}),
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("molic.export", () => {
			MoLICPanel.currentPanel?.export(); // Você precisará criar esse método público
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

		// Define o HTML uma única vez para estabilizar o Service Worker
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

		// Primeira carga: Aguarda a webview estar pronta para receber a mensagem
		this._panel.webview.onDidReceiveMessage(
			(message) => {
				if (message.command === "ready") {
					this._update();
				}
			},
			null,
			this._disposables,
		);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Monitora mudanças no texto com o Debounce de 300ms
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
			this._disposables,
		);

		// Atualiza se o usuário trocar de aba de arquivo
		vscode.window.onDidChangeActiveTextEditor(
			() => this._update(),
			null,
			this._disposables,
		);

		this._panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case "saveFile":
						const uri = await vscode.window.showSaveDialog({
							filters: { Images: ["svg"] },
							defaultUri: vscode.Uri.file("diagrama-molic.svg"),
						});

						if (uri) {
							const encoder = new TextEncoder();
							const data = encoder.encode(message.text);
							await vscode.workspace.fs.writeFile(uri, data);
							vscode.window.showInformationMessage(
								"Diagrama exportado com sucesso!",
							);
						}
						return;
				}
			},
			null,
			this._disposables,
		);
	}

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor?.viewColumn;

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
		if (!editor || !this._panel.visible) {
			return;
		}

		// Envia o texto para a "cozinha" (webview) processar
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
						/* Impede a seleção de texto em toda a webview */
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

	public export() {
		this._panel.webview.postMessage({ command: "export" });
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
