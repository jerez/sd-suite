import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const pluginPath = path.resolve(dirname, "../dev.jerez.sds.control-mesh.sdPlugin");
const manifestPath = path.resolve(dirname, "../dev.jerez.sds.control-mesh.sdPlugin/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
	$schema?: string;
	Actions: Array<{
		Icon: string;
		Name: string;
		PropertyInspectorPath?: string;
		States: [{ Image: string }];
		UserTitleEnabled?: boolean;
		UUID: string;
	}>;
	Author: string;
	Category?: string;
	CategoryIcon: string;
	Icon: string;
	Name: string;
	UUID: string;
};

describe("Control Mesh manifest", () => {
	it("references the current Stream Deck manifest schema", () => {
		expect(manifest.$schema).toBe("https://schemas.elgato.com/streamdeck/plugins/manifest.json");
	});

	it("uses the Control Mesh publication identity", () => {
		expect(manifest.Name).toBe("Control Mesh");
		expect(manifest.Author).toBe("Jerez");
		expect(manifest.Category).toBe("Control Mesh");
		expect(manifest.UUID).toBe("dev.jerez.sds.control-mesh");
	});

	it("prefixes action UUIDs with the plugin UUID", () => {
		expect(manifest.Actions).not.toHaveLength(0);

		for (const action of manifest.Actions) {
			expect(action.UUID.startsWith(`${manifest.UUID}.`)).toBe(true);
		}
	});

	it("does not include scaffold counter actions", () => {
		expect(manifest.Actions.map((action) => action.UUID)).not.toContain("dev.jerez.sds.control-mesh.increment");
	});

	it("exposes setup and remote execution actions", () => {
		expect(manifest.Actions).toHaveLength(2);
		expect(manifest.Actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					Name: "Control Mesh Setup",
					PropertyInspectorPath: "ui/control-mesh-setup.html",
					UUID: "dev.jerez.sds.control-mesh.setup",
				}),
				expect.objectContaining({
					Name: "Execute Remote Action",
					PropertyInspectorPath: "ui/execute-remote-action.html",
					UUID: "dev.jerez.sds.control-mesh.execute-remote-action",
				}),
			]),
		);
	});

	it("hides the native title field only for the setup action", () => {
		const setupAction = findManifestAction("dev.jerez.sds.control-mesh.setup");
		const executeAction = findManifestAction("dev.jerez.sds.control-mesh.execute-remote-action");

		expect(setupAction.UserTitleEnabled).toBe(false);
		expect(executeAction.UserTitleEnabled).not.toBe(false);
	});

	it("wires Control Mesh visual identity assets", () => {
		const executeAction = findManifestAction("dev.jerez.sds.control-mesh.execute-remote-action");
		const setupAction = findManifestAction("dev.jerez.sds.control-mesh.setup");

		expect(manifest.Icon).toBe("imgs/plugin/icon");
		expect(manifest.CategoryIcon).toBe("imgs/plugin/category-glyph");
		expect(executeAction.Icon).toBe("imgs/actions/execute-remote-action/icon");
		expect(executeAction.States[0].Image).toBe("imgs/actions/execute-remote-action/key-default");
		expect(setupAction.Icon).toBe("imgs/actions/control-mesh-setup/icon");
		expect(setupAction.States[0].Image).toBe("imgs/actions/control-mesh-setup/key-default");
	});

	it("references existing visual identity assets", () => {
		const executeAction = findManifestAction("dev.jerez.sds.control-mesh.execute-remote-action");
		const setupAction = findManifestAction("dev.jerez.sds.control-mesh.setup");

		expect(existsSync(path.join(pluginPath, `${manifest.Icon}.png`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${manifest.Icon}@2x.png`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${manifest.CategoryIcon}.svg`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${executeAction.Icon}.svg`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${executeAction.States[0].Image}.svg`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${setupAction.Icon}.svg`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${setupAction.States[0].Image}.svg`))).toBe(true);
	});

	it("keeps raster visual identity exports transparent", () => {
		for (const pngPath of [
			"imgs/plugin/category-icon.png",
			"imgs/plugin/category-icon@2x.png",
			"imgs/plugin/icon.png",
			"imgs/plugin/icon@2x.png",
			"imgs/plugin/marketplace.png",
			"imgs/plugin/marketplace@2x.png",
		]) {
			expect(readPngColorType(path.join(pluginPath, pngPath))).toBe(6);
		}
	});
});

function findManifestAction(uuid: string) {
	const action = manifest.Actions.find((item) => item.UUID === uuid);

	if (!action) {
		throw new Error(`Action ${uuid} not found.`);
	}

	return action;
}

function readPngColorType(filePath: string): number {
	const png = readFileSync(filePath);

	return png[25] ?? -1;
}
