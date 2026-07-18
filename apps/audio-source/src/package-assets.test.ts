import { access } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const pluginRoot = new URL("../dev.jerez.sds.audio-source.sdPlugin/", import.meta.url);
const requiredFiles = [
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
