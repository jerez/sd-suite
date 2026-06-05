import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const pluginPath = path.resolve(dirname, "../dev.jerez.sds.control-mesh.sdPlugin");
const propertyInspectorSourcePath = path.join(dirname, "property-inspector/execute-remote-action.ts");
const setupPropertyInspectorSourcePath = path.join(dirname, "property-inspector/control-mesh-setup.ts");
const manifestPath = path.join(pluginPath, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
	Actions: Array<{ PropertyInspectorPath?: string; UUID: string }>;
};

function getSetupPanelMarkup(html: string, panelName: string): string {
	const panelStart = html.indexOf(`<div data-setup-panel="${panelName}"`);
	const nextPanelStart = html.indexOf("<div data-setup-panel=", panelStart + 1);
	const validationStart = html.indexOf('<sdpi-item id="validation-item"', panelStart);
	const panelEnd = nextPanelStart === -1 ? validationStart : nextPanelStart;

	return html.slice(panelStart, panelEnd);
}

describe("Control Mesh property inspector assets", () => {
	it("uses a native static property inspector for Execute Remote Action", () => {
		const action = manifest.Actions.find((item) => item.UUID === "dev.jerez.sds.control-mesh.execute-remote-action");
		const html = readFileSync(path.join(pluginPath, "ui/execute-remote-action.html"), "utf8");

		expect(action?.PropertyInspectorPath).toBe("ui/execute-remote-action.html");
		expect(existsSync(path.join(pluginPath, "ui/execute-remote-action.html"))).toBe(true);
		expect(existsSync(propertyInspectorSourcePath)).toBe(true);
		expect(html).toContain('<script src="./sdpi-components.js"></script>');
		expect(html).toContain('<script type="module" src="./execute-remote-action.js"></script>');
	});

	it("keeps Execute Remote Action focused on per-key caller settings", () => {
		const html = readFileSync(path.join(pluginPath, "ui/execute-remote-action.html"), "utf8");

		for (const label of ["Target Peer", "Remote Action", "Description"]) {
			expect(html).toContain(label);
		}

		expect(html).toContain('datasource="getTrustedPeers"');
		expect(html).toContain('datasource="getRemoteActions"');
		expect(html).toContain('label-setting="targetNodeLabel"');
		expect(html).toContain('label-setting="actionLabel"');
		expect(html).toContain('<sdpi-textfield id="remote-action-description" disabled>');
		expect(html).toContain("show-refresh");

		for (const id of ["refresh-actions-button", "test-action-button"]) {
			expect(html).not.toContain(id);
		}

		for (const globalLabel of ["Local MCP URL", "Local Executor", "Known Peer", "Shared Secret", "Discovery"]) {
			expect(html).not.toContain(globalLabel);
		}

		expect(html).not.toContain("peer node id");
		expect(html).not.toContain("remote MCP action id");
		expect(html).not.toContain("Arguments JSON");
		expect(html).not.toContain("Display Label");
		expect(html).not.toContain("save-global-button");
		expect(html).not.toContain("save-action-button");
	});

	it("uses a native static property inspector for Control Mesh Setup", () => {
		const action = manifest.Actions.find((item) => item.UUID === "dev.jerez.sds.control-mesh.setup");
		const html = readFileSync(path.join(pluginPath, "ui/control-mesh-setup.html"), "utf8");

		expect(action?.PropertyInspectorPath).toBe("ui/control-mesh-setup.html");
		expect(existsSync(path.join(pluginPath, "ui/control-mesh-setup.html"))).toBe(true);
		expect(existsSync(setupPropertyInspectorSourcePath)).toBe(true);
		expect(html).toContain('<script src="./sdpi-components.js"></script>');
		expect(html).toContain('<script type="module" src="./control-mesh-setup.js"></script>');
	});

	it("keeps global setup controls in the setup property inspector", () => {
		const html = readFileSync(path.join(pluginPath, "ui/control-mesh-setup.html"), "utf8");

		expect(html).toContain('<sdpi-radio id="setup-section" columns="2">');

		for (const label of [
			"This Node",
			"Mesh",
			"Setup help",
			"Local MCP URL",
			"Local MCP check",
			"Local MCP status",
			"Expose actions",
			"Mesh endpoint",
			"Network status",
			"Discovered peers (not trusted yet)",
			"Peers",
			"Pair request",
			"Peer name",
			"Peer endpoint",
			"Peer actions",
			"Connection status",
		]) {
			expect(html).toContain(label);
		}

		for (const control of [
			"setup-help",
			"test-local-mcp-button",
			"discover-peers-button",
			"local-mcp-result",
			"local-mcp-result-item",
			"discovery-result",
			"discovery-result-item",
			"network-result",
			"network-result-item",
			"known-peer-selector",
			"incoming-pairing-message",
			"approve-pairing-button",
			"reject-pairing-button",
			"pair-peer-button",
			"remove-peer-button",
			"rotate-secret-button",
			"test-peer-button",
		]) {
			expect(html).toContain(`id="${control}"`);
		}

		for (const panel of ['data-setup-panel="node"', 'data-setup-panel="mesh"']) {
			expect(html).toContain(panel);
		}

		expect(html).not.toContain('data-setup-panel="local"');
		expect(html).not.toContain('data-setup-panel="network"');
		expect(html).not.toContain('<option value="local">');
		expect(html).not.toContain('<option value="network">');
		expect(html).not.toContain("save-global-button");
		expect(html).not.toContain("Setup status");
		expect(html).not.toContain('id="setup-status"');
		expect(html).not.toContain("Node ID");
		expect(html).not.toContain("Shared secret");
		expect(html).not.toContain('id="local-node-id"');
		expect(html).not.toContain('id="known-peer-id"');
		expect(html).not.toContain('id="trust-secret"');
		expect(html).not.toContain('id="add-peer-button"');
		expect(html).not.toContain('id="generate-secret-button"');
		expect(html).not.toContain('id="copy-secret-button"');
	});

	it("renders local MCP test output with SDPI components", () => {
		const html = readFileSync(path.join(pluginPath, "ui/control-mesh-setup.html"), "utf8");

		expect(html).toContain('id="local-mcp-result-item"');
		expect(html).toContain(
			'<sdpi-textarea id="local-mcp-result" class="connection-result" role="alert" rows="4" disabled>',
		);
		expect(html).toContain('.connection-result[data-state="error"]');
		expect(html).toContain('.connection-result[data-state="success"]');
	});

	it("uses SDPI fields for setup display rows", () => {
		const html = readFileSync(path.join(pluginPath, "ui/control-mesh-setup.html"), "utf8");

		for (const id of ["validation-message"]) {
			expect(html).not.toContain(`<p id="${id}"`);
			expect(html).not.toContain(`<span id="${id}"`);
			expect(html).toMatch(new RegExp(`<sdpi-textfield id="${id}"[^>]* disabled>`));
		}

		expect(html).not.toContain('<p id="local-mcp-result"');
		expect(html).not.toContain('<span id="local-mcp-result"');
		expect(html).toMatch(/<sdpi-textarea[\s\S]*id="local-mcp-result"[\s\S]*rows="4"[\s\S]*disabled[\s\S]*>/);
		expect(html).toMatch(/<sdpi-textarea[\s\S]*id="peer-connection-state"[\s\S]*rows="4"[\s\S]*disabled[\s\S]*>/);

		expect(html).not.toContain("setup-tab");
	});

	it("keeps node and mesh setup content in the matching sections", () => {
		const html = readFileSync(path.join(pluginPath, "ui/control-mesh-setup.html"), "utf8");
		const nodePanel = getSetupPanelMarkup(html, "node");
		const meshPanel = getSetupPanelMarkup(html, "mesh");

		expect(nodePanel).toContain("Node name");
		expect(nodePanel).toContain("Expose actions");
		expect(nodePanel).toContain("Local MCP URL");
		expect(nodePanel).toContain('placeholder="http://localhost:9090/mcp"');
		expect(nodePanel).toContain("test-local-mcp-button");
		expect(nodePanel).toContain("Listen Port");
		expect(nodePanel).toContain("Mesh endpoint");
		expect(nodePanel).toContain('id="advertised-url"');
		expect(nodePanel).toContain("disabled");
		expect(nodePanel).toContain("data-executor-setting");
		expect(nodePanel).toContain("data-executor-result");
		expect(nodePanel.match(/data-executor-setting[\s\S]*?hidden/g)).toHaveLength(4);
		expect(nodePanel).not.toContain("Listen Host");
		expect(nodePanel).not.toContain("Discover peers");
		expect(nodePanel).not.toContain("Discovered peers (not trusted yet)");

		expect(meshPanel).toContain("Discover peers");
		expect(meshPanel).toContain("Discovered peers (not trusted yet)");
		expect(meshPanel).toContain("Peers");
		expect(meshPanel).not.toContain('label="Peer ID"');
		expect(meshPanel).not.toContain('id="known-peer-id"');
		expect(meshPanel).not.toContain("Shared secret");
		expect(meshPanel).not.toContain('id="trust-secret"');
		expect(meshPanel.match(/data-peer-detail[\s\S]*?hidden/g)).toHaveLength(4);
		expect(meshPanel).toMatch(/<sdpi-textfield id="known-peer-name"[^>]*disabled>/);
		expect(meshPanel).toMatch(/<sdpi-textfield id="known-peer-endpoint"[^>]*disabled>/);
		expect(meshPanel).not.toContain("Local MCP URL");
		expect(meshPanel).not.toContain("Expose actions");
	});
});
