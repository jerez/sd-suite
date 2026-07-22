import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { stageDevelopmentBridge, stageReleaseArtifacts, validateStagedRelease } from "./native-artifacts.mjs";

const testRoots = [];

async function createTestRoot() {
	const root = await mkdtemp(path.join(os.tmpdir(), "audio-source-native-"));
	testRoots.push(root);
	return root;
}

afterEach(async () => {
	await Promise.all(testRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native artifact staging", () => {
	it("stages only the two compiled release executables", async () => {
		const root = await createTestRoot();
		await mkdir(path.join(root, ".native/macos"), { recursive: true });
		await mkdir(path.join(root, ".native/windows"), { recursive: true });
		await writeFile(path.join(root, ".native/macos/audio-bridge"), "mac");
		await writeFile(path.join(root, ".native/windows/audio-bridge.exe"), "MZwindows");

		await stageReleaseArtifacts(root);
		await expect(validateStagedRelease(root)).resolves.toBeUndefined();
		await expect(
			readFile(path.join(root, "dev.jerez.sds.audio-source.sdPlugin/native/macos/audio-bridge"), "utf8"),
		).resolves.toBe("mac");
		await expect(
			readFile(path.join(root, "dev.jerez.sds.audio-source.sdPlugin/native/windows/audio-bridge.exe"), "utf8"),
		).resolves.toBe("MZwindows");
		await expect(
			access(path.join(root, "dev.jerez.sds.audio-source.sdPlugin/native/.development-mode")),
		).rejects.toThrow();
	});

	it("stages interpreted source only after an explicit development request", async () => {
		const root = await createTestRoot();
		await mkdir(path.join(root, "native/macos/Sources/AudioBridge"), { recursive: true });
		await writeFile(path.join(root, "native/macos/Sources/AudioBridge/main.swift"), "swift");

		await stageDevelopmentBridge(root, "darwin");

		await expect(
			readFile(path.join(root, "dev.jerez.sds.audio-source.sdPlugin/native/.development-mode"), "utf8"),
		).resolves.toBe("darwin\n");
		await expect(
			readFile(path.join(root, "dev.jerez.sds.audio-source.sdPlugin/native/macos/main.swift"), "utf8"),
		).resolves.toBe("swift");
	});
});
