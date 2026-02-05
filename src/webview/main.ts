import mermaid from "mermaid";
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

mermaid.initialize({
	startOnLoad: false,
	securityLevel: "loose",
	theme: "default",
	flowchart: {
		htmlLabels: true,
		useMaxWidth: false,
		curve: "linear",
		nodeSpacing: 50,
		rankSpacing: 50,
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

	diagram += `classDef sceneStyle fill:#fff,stroke:#333,stroke-width:2px,rx:10,ry:10;\n`;
	diagram += `classDef ubiqStyle fill:#e0e0e0,stroke:#333,stroke-width:2px,rx:30,ry:30;\n`;
	diagram += `classDef systemProc fill:#0a0a0a,stroke:#0a0a0a,rx:0,ry:0;\n`;

	const cleanText = text.replace(/\/\/.*$/gm, "");
	let match;

	// 1. Ubíquos
	const ubiqRegex = /ubiq\s+(\w+)/g;
	while ((match = ubiqRegex.exec(cleanText)) !== null) {
		diagram += `    ${match[1]}["&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"]:::ubiqStyle\n`;
	}

	// 2. Cenas (Apenas Título)
	const sceneRegex = /scene\s+(\w+)(?:\s*{[^}]*title:\s*"([^"]*)"[^}]*})?/g;
	while ((match = sceneRegex.exec(cleanText)) !== null) {
		const [_, name, titleMatch] = match;
		const title = (titleMatch || name).replace(/[^a-zA-Z0-9À-ÿ ]/g, "");
		diagram += `    ${name}["${title}"]:::sceneStyle\n`;
	}

	// 3. Processos e Transições (mantendo sua lógica)
	const procRegex = /proc\s+(\w+)/g;
	while ((match = procRegex.exec(cleanText)) !== null) {
		diagram += `    ${match[1]}[" "]:::systemProc\n`;
	}

	// 4. Transições de RECUPERAÇÃO (Tracejadas) - PRIORIDADE
	const recoveryRegex = /recovery\s+(\w+)\s*->\s*(\w+)(?:\s+"([^"]*)")?/g;
	while ((match = recoveryRegex.exec(cleanText)) !== null) {
		const [_, from, to, msg] = match;
		const cleanMsg = msg ? `|"${msg.replace(/"/g, "'")}"|` : "";
		diagram += `    ${from} -.->${cleanMsg} ${to}\n`;
	}

	// 5. Transições de DIÁLOGO (Normais)
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

document.getElementById("export-btn")?.addEventListener("click", () => {
	exportSVG();
});

window.addEventListener("message", (event) => {
	if (event.data.command === "export") {
		exportSVG();
	}
});
