import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const manifestPath = new URL("../dev.jerez.sds.audio-source.sdPlugin/manifest.json", import.meta.url);

describe("audio-source manifest", () => {
	it("uses the suite identity and preserves supported runtimes", async () => {
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

		expect(manifest.UUID).toBe("dev.jerez.sds.audio-source");
		expect(manifest.SDKVersion).toBe(3);
		expect(manifest.Software.MinimumVersion).toBe("6.9");
		expect(manifest.Nodejs.Version).toBe("20");
		expect(manifest.OS).toEqual([
			{ Platform: "mac", MinimumVersion: "12" },
			{ Platform: "windows", MinimumVersion: "10" },
		]);
	});

	it("registers the two encoder actions and shared custom layout", async () => {
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

		expect(manifest.Actions.map((action: { UUID: string }) => action.UUID)).toEqual([
			"dev.jerez.sds.audio-source.cycle-audio-output",
			"dev.jerez.sds.audio-source.cycle-audio-input",
		]);
		for (const action of manifest.Actions) {
			expect(action.Controllers).toEqual(["Encoder"]);
			expect(action.Encoder.layout).toBe("layouts/output-device.json");
		}
	});
});
