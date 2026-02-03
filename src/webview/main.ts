import mermaid from "mermaid";

mermaid.initialize({
	startOnLoad: false,
	theme: "dark",
	securityLevel: "loose",
	flowchart: {
		useMaxWidth: true,
		htmlLabels: true,
		curve: "basis",
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

	const cleanText = text.replace(/\/\/.*$/gm, "");

	const sceneRegex = /scene\s+(\w+)\s*{([^}]*)}/g;
	const transitionRegex = /transition\s+(\w+)\s*->\s*(\w+)/g;

	let match;
	let hasContent = false;

	while ((match = sceneRegex.exec(cleanText)) !== null) {
		hasContent = true;
		const [_, name, content] = match;
		const dialogueMatch = content.match(/(?:s|u):\s*"([^"]*)"/);
		const label = dialogueMatch ? dialogueMatch[1] : name;
		diagram += `    ${name}(["${label}"])\n`;
	}

	while ((match = transitionRegex.exec(cleanText)) !== null) {
		hasContent = true;
		const [_, from, to] = match;
		diagram += `    ${from} --> ${to}\n`;
	}

	if (!hasContent) {
		diagram += "    Empty((Digite uma 'scene' para começar))\n";
	}

	return diagram;
}