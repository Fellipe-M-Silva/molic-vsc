import mermaid from "mermaid";

mermaid.initialize({
	startOnLoad: false,
	theme: "base",
	securityLevel: "loose",
	themeVariables: {
		primaryColor: "#ffffff",
		primaryBorderColor: "#0a0a0a",
		lineColor: "#0a0a0a",
		secondaryColor: "#cccccc",
		tertiaryColor: "#0a0a0a",
	},
	flowchart: {
		useMaxWidth: true,
		htmlLabels: true,
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

		appElement.innerHTML = `<pre class="mermaid">${mermaidSyntax}</pre>`;

		await mermaid.run();
	} catch (err) {
		appElement.innerHTML = `
            <div style="color: var(--vscode-errorForeground); padding: 10px; border: 1px solid red;">
                <h3>Erro na Modelagem MoLIC:</h3>
                <pre style="white-space: pre-wrap;">${err}</pre>
            </div>`;
	}
}

function parseMoLICtoMermaid(text: string): string {
	let diagram = "graph TD\n";

	// Definição de estilos
	diagram +=
		"classDef sceneStyle fill:#fff,stroke:#000,stroke-width:2px,rx:10,ry:10;\n";
	diagram +=
		"classDef ubiqStyle fill:#e0e0e0,stroke:#000,stroke-width:2px,rx:5,ry:5;\n";
	diagram += "classDef systemProc fill:#000,color:#fff,stroke:#000;\n";

	const cleanText = text.replace(/\/\/.*$/gm, "");
	let match: RegExpExecArray | null;

	// --- 1. ACESSOS UBÍQUOS (Declarados primeiro para garantir o topo) ---
	const ubiqRegex = /ubiq\s+(\w+)\s*{([^}]*)}/g;
	const ubiqNames: string[] = [];

	while ((match = ubiqRegex.exec(cleanText)) !== null) {
		const [_, name, content] = match;
		const label = content.match(/"([^"]*)"/)?.[1] || " ";
		diagram += `    ${name}["${label}"]:::ubiqStyle\n`;
		ubiqNames.push(name);
	}

	// Link invisível para alinhamento horizontal no topo
	if (ubiqNames.length > 1) {
		diagram += "    " + ubiqNames.join(" ~~~ ") + "\n";
	}

	// --- 2. CENAS (Declaradas depois dos ubíquos) ---
	const sceneRegex = /scene\s+(\w+)\s*{([^}]*)}/g;
	while ((match = sceneRegex.exec(cleanText)) !== null) {
		const [_, name, content] = match;
		const dialogue = content.match(/(?:s|u):\s*"([^"]*)"/)?.[1] || name;
		diagram += `    ${name}["${dialogue}"]:::sceneStyle\n`;
	}

	// --- 3. PROCESSOS DE SISTEMA ---
	const procRegex = /proc\s+(\w+)/g;
	while ((match = procRegex.exec(cleanText)) !== null) {
		diagram += `    ${match[1]}[" "]:::systemProc\n`;
	}

	// --- 4. TRANSIÇÕES E RECUPERAÇÃO (Sempre por último) ---
	const transRegex = /transition\s+(\w+)\s*->\s*(\w+)(?:\s+"([^"]*)")?/g;
	while ((match = transRegex.exec(cleanText)) !== null) {
		const [_, from, to, msg] = match;
		const label = msg ? `|"${msg}"|` : "";
		diagram += `    ${from} -->${label} ${to}\n`;
	}

	const recoveryRegex = /recovery\s+(\w+)\s*->\s*(\w+)(?:\s+"([^"]*)")?/g;
	while ((match = recoveryRegex.exec(cleanText)) !== null) {
		const [_, from, to, msg] = match;
		const label = msg ? `|"${msg}"|` : "";
		diagram += `    ${from} -.->${label} ${to}\n`;
	}

	return diagram;
}
