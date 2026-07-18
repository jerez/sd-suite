import { access, readFile } from "node:fs/promises";

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
const pngAssets = [
	["imgs/plugin/category-icon.png", 28, 28],
	["imgs/plugin/category-icon@2x.png", 56, 56],
	["imgs/plugin/icon.png", 256, 256],
	["imgs/plugin/icon@2x.png", 512, 512],
	["imgs/plugin/marketplace.png", 288, 288],
	["imgs/plugin/marketplace@2x.png", 512, 512],
] as const;

function pngChunkTypes(png: Buffer): string[] {
	const chunks: string[] = [];
	for (let offset = 8; offset < png.length; ) {
		const length = png.readUInt32BE(offset);
		chunks.push(png.toString("ascii", offset + 4, offset + 8));
		offset += length + 12;
	}
	return chunks;
}

describe("audio-source package assets", () => {
	it.each(requiredFiles)("includes %s", async (relativePath) => {
		await expect(access(new URL(relativePath, pluginRoot))).resolves.toBeUndefined();
	});

	it.each(pngAssets)("encodes %s as RGBA without EXIF at %ix%i", async (relativePath, width, height) => {
		const png = await readFile(new URL(relativePath, pluginRoot));

		expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		expect(png.readUInt32BE(16)).toBe(width);
		expect(png.readUInt32BE(20)).toBe(height);
		expect(png[25]).toBe(6);
		expect(pngChunkTypes(png)).not.toContain("eXIf");
	});
});
