import { access } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const pluginRoot = new URL("../dev.jerez.sds.audio-source.sdPlugin/", import.meta.url);
const requiredFiles = [
	"imgs/plugin/category-icon.png",
	"imgs/plugin/category-icon@2x.png",
	"imgs/plugin/icon.png",
	"imgs/plugin/icon@2x.png",
	"imgs/plugin/marketplace.png",
	"imgs/plugin/marketplace@2x.png",
	"imgs/actions/audio/icon.svg",
	"imgs/actions/audio/encoder.svg",
	"layouts/output-device.json",
	"native/mac/audio-bridge.swift",
	"native/windows/audio-bridge.ps1",
	"native/windows/audio-bridge.cs",
];

describe("audio-source package assets", () => {
	it.each(requiredFiles)("includes %s", async (relativePath) => {
		await expect(access(new URL(relativePath, pluginRoot))).resolves.toBeUndefined();
	});
});
