import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const pluginPath = path.resolve(dirname, "../dev.jerez.sds.usb-link.sdPlugin");
const manifestPath = path.resolve(pluginPath, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
	$schema?: string;
	Actions: Array<{
		Icon: string;
		Name: string;
		PropertyInspectorPath?: string;
		States: [{ Image: string }];
		UUID: string;
	}>;
	Author: string;
	Category?: string;
	CategoryIcon: string;
	Icon: string;
	Name: string;
	UUID: string;
};

describe("USB Link manifest", () => {
	it("references the current Stream Deck manifest schema", () => {
		expect(manifest.$schema).toBe("https://schemas.elgato.com/streamdeck/plugins/manifest.json");
	});

	it("uses the USB Link publication identity", () => {
		expect(manifest.Name).toBe("USB Link");
		expect(manifest.Author).toBe("Jerez");
		expect(manifest.Category).toBe("USB Link");
		expect(manifest.UUID).toBe("dev.jerez.sds.usb-link");
	});

	it("prefixes action UUIDs with the plugin UUID", () => {
		expect(manifest.Actions).not.toHaveLength(0);

		for (const action of manifest.Actions) {
			expect(action.UUID.startsWith(`${manifest.UUID}.`)).toBe(true);
		}
	});

	it("does not include the scaffold counter action", () => {
		expect(manifest.Actions.map((action) => action.UUID)).not.toContain("dev.jerez.sds.usb-link.increment");
	});

	it("exposes four explicit USBNG actions", () => {
		expect(manifest.Actions).toHaveLength(4);
		expect(manifest.Actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					Name: "Share Device",
					PropertyInspectorPath: "ui/share-device.html",
					UUID: "dev.jerez.sds.usb-link.share-device",
				}),
				expect.objectContaining({
					Name: "Unshare Device",
					PropertyInspectorPath: "ui/unshare-device.html",
					UUID: "dev.jerez.sds.usb-link.unshare-device",
				}),
				expect.objectContaining({
					Name: "Connect Device",
					PropertyInspectorPath: "ui/connect-device.html",
					UUID: "dev.jerez.sds.usb-link.connect-device",
				}),
				expect.objectContaining({
					Name: "Disconnect Device",
					PropertyInspectorPath: "ui/disconnect-device.html",
					UUID: "dev.jerez.sds.usb-link.disconnect-device",
				}),
			]),
		);
	});

	it("wires plugin and action asset paths", () => {
		expect(manifest.Icon).toBe("imgs/plugin/marketplace");
		expect(manifest.CategoryIcon).toBe("imgs/plugin/category-icon");

		for (const action of manifest.Actions) {
			expect(action.Icon.startsWith("imgs/actions/")).toBe(true);
			expect(action.States[0].Image.startsWith("imgs/actions/")).toBe(true);
		}
	});

	it("references existing plugin raster assets", () => {
		expect(existsSync(path.join(pluginPath, `${manifest.Icon}.png`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${manifest.Icon}@2x.png`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${manifest.CategoryIcon}.png`))).toBe(true);
		expect(existsSync(path.join(pluginPath, `${manifest.CategoryIcon}@2x.png`))).toBe(true);
	});
});
