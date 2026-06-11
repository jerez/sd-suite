import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packagePath = path.resolve(dirname, "..");
const pluginPath = path.resolve(packagePath, "dev.jerez.sds.usb-link.sdPlugin");
const readmePath = path.resolve(packagePath, "README.md");
const userGuidePath = path.resolve(packagePath, "docs/user-guide.md");
const developerGuidePath = path.resolve(packagePath, "docs/developer-guide.md");

describe("USB Link property inspector assets", () => {
	it("ships one property inspector html file per action", () => {
		expect(existsSync(path.join(pluginPath, "ui/share-device.html"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "ui/unshare-device.html"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "ui/connect-device.html"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "ui/disconnect-device.html"))).toBe(true);
	});

	it("ships all referenced action icon assets", () => {
		expect(existsSync(path.join(pluginPath, "imgs/actions/share-device/icon.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/share-device/key-default.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/unshare-device/icon.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/unshare-device/key-default.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/connect-device/icon.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/connect-device/key-default.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/disconnect-device/icon.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/actions/disconnect-device/key-default.svg"))).toBe(true);
	});

	it("ships shared active, success, and error state images", () => {
		expect(existsSync(path.join(pluginPath, "imgs/states/active.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/states/success.svg"))).toBe(true);
		expect(existsSync(path.join(pluginPath, "imgs/states/error.svg"))).toBe(true);
	});

	it("documents the local-only boundary and adapter strategy", () => {
		const readme = readFileSync(readmePath, "utf8");
		const userGuide = readFileSync(userGuidePath, "utf8");
		const developerGuide = readFileSync(developerGuidePath, "utf8");

		expect(readme).toContain("local-only");
		expect(readme).toContain("device name");
		expect(userGuide).toContain("same machine");
		expect(userGuide).toContain("Share Device");
		expect(userGuide).toContain("Disconnect Device");
		expect(developerGuide).toContain("AppleScript");
		expect(developerGuide).toContain("UsbService64.exe");
		expect(developerGuide).toContain("strict name matching");
	});
});
