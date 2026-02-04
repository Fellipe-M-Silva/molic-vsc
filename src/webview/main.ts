import mermaid from "mermaid";
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

mermaid.initialize({
	startOnLoad: false,
	securityLevel: "loose",
	theme: "default",
	flowchart: {
		htmlLabels: true,
		useMaxWidth: true,
		curve: "linear",
	},
});

const appElement = document.getElementById("app")!;

window.addEventListener("message", (event) => {
	const message = event.data;

	if (message.command === "render") {
		renderDiagram(message.text);
	}
});

async function renderDiagram(text: string) {
	try {
		const mermaidSyntax = parseMoLICtoMermaid(text);
		const id = "mermaid-" + Math.random().toString(36).substr(2, 9);
		const { svg } = await mermaid.render(id, mermaidSyntax);
		appElement.innerHTML = `<div id="graphDiv">${svg}</div>`;
	} catch (err: any) {
		appElement.innerHTML = `<div style="color:red">Erro de Sintaxe: ${err.message}</div>`;
	}
}

function parseMoLICtoMermaid(text: string): string {
	let diagram = "graph TD\n";

	// Definições de estilo fixas (sem variáveis CSS para não bugar o parser)
	diagram += `classDef sceneStyle fill:#fff,stroke:#333,stroke-width:2px,rx:10,ry:10;\n`;
	diagram += `classDef ubiqStyle fill:#e0e0e0,stroke:#333,stroke-width:2px,rx:30,ry:30;\n`;
	diagram += `classDef systemProc fill:#333,stroke:#333,rx:0,ry:0;\n`;

	const cleanText = text.replace(/\/\/.*$/gm, "");
	let match;

	// 1. Ubíquos
	const ubiqRegex = /ubiq\s+(\w+)/g;
	while ((match = ubiqRegex.exec(cleanText)) !== null) {
		// Adicionamos espaços em branco para esticar a pílula
		diagram += `    ${match[1]}["&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"]:::ubiqStyle\n`;
	}

	// 2. Cenas (Figura 9.16)
	const sceneRegex = /scene\s+(\w+)\s*{([^}]*)}/g;
	while ((match = sceneRegex.exec(cleanText)) !== null) {
		const [_, name, content] = match;

		// NOVO REGEX: Permite letras acentuadas (A-zÀ-ÿ)
		const title = (
			content.match(/title:\s*"([^"]*)"/)?.[1] || name
		).replace(/[^a-zA-Z0-9À-ÿ ]/g, "");

		const detailsMatch = content.match(/details:\s*{([^}]*)}/s);

		// Estrutura HTML robusta para o Mermaid
		let label = `<div style='display:block; min-width:100px;'>`;
		label += `<div style='font-weight:bold; margin-bottom:4px;'>${title}</div>`;

		if (detailsMatch) {
			const lines = detailsMatch[1]
				.split("\n")
				.map((l) => l.trim().replace(/[\[\]\(\)\{\}\"\|]/g, ""))
				.filter((l) => l.length > 0 && !l.startsWith("details"));

			if (lines.length > 0) {
				label += `<div style='border-top:1px solid #333; margin:4px 0;'></div>`;
				label += `<div style='font-size:11px; text-align:left;'>${lines.join("<br/>")}</div>`;
			}
		}
		label += `</div>`;

		// Remove quebras de linha reais para não quebrar a sintaxe do Mermaid
		const finalLabel = label.replace(/\n/g, " ").replace(/\s+/g, " ");
		diagram += `    ${name}["${finalLabel}"]:::sceneStyle\n`;
	}

	// 3. Processos e Transições (mantendo sua lógica)
	const procRegex = /proc\s+(\w+)/g;
	while ((match = procRegex.exec(cleanText)) !== null) {
		diagram += `    ${match[1]}[" "]:::systemProc\n`;
	}

	const transRegex = /transition\s+(\w+)\s*->\s*(\w+)(?:\s+"([^"]*)")?/g;
	while ((match = transRegex.exec(cleanText)) !== null) {
		const [_, from, to, msg] = match;
		const cleanMsg = msg ? `|"${msg.replace(/"/g, "'")}"|` : "";
		diagram += `    ${from} -->${cleanMsg} ${to}\n`;
	}

	return diagram;
}

vscode.postMessage({ command: "ready" });

function exportSVG() {
	const svgElement = document.querySelector("#app svg");
	if (svgElement) {
		// Garante que o XML do SVG seja válido para exportação
		let svgData = svgElement.outerHTML;
		if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
			svgData = svgData.replace(
				"<svg",
				'<svg xmlns="http://www.w3.org/2000/svg"',
			);
		}

		vscode.postMessage({
			command: "saveFile",
			text: svgData,
		});
	} else {
		console.error("SVG não encontrado para exportação.");
	}
}

// Escuta o clique
document.getElementById("export-btn")?.addEventListener("click", () => {
	exportSVG();
});

// Listener para o comando de exportação via Ctrl+Shift+P
window.addEventListener("message", (event) => {
	if (event.data.command === "export") {
		exportSVG();
	}
});
