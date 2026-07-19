import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { nativePluginRoots, resolveNativeCommand } from "./native-command";

const testRoots: string[] = [];

function createRoot(): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "audio-source-native-command-"));
	testRoots.push(root);
	return root;
}

function createFile(root: string, relativePath: string, contents = ""): string {
	const file = path.join(root, relativePath);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, contents);
	return file;
}

afterEach(() => {
	for (const root of testRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("native command resolution", () => {
	it("resolves the compiled macOS bridge", () => {
		const compiledRoot = createRoot();
		const executable = createFile(compiledRoot, "native/macos/audio-bridge");

		expect(resolveNativeCommand("darwin", [compiledRoot])).toEqual({
			executable,
			prefixArgs: [],
		});
	});

	it("resolves the compiled Windows bridge", () => {
		const compiledRoot = createRoot();
		const executable = createFile(compiledRoot, "native/windows/audio-bridge.exe");

		expect(resolveNativeCommand("win32", [compiledRoot])).toEqual({
			executable,
			prefixArgs: [],
		});
	});

	it("uses the staged macOS source only with an explicit development marker", () => {
		const developmentRoot = createRoot();
		createFile(developmentRoot, "native/.development-mode", "darwin\n");
		const source = createFile(developmentRoot, "native/macos/main.swift");

		expect(resolveNativeCommand("darwin", [developmentRoot])).toEqual({
			executable: "/usr/bin/swift",
			prefixArgs: [source],
		});
	});

	it("uses the staged Windows source only with an explicit development marker", () => {
		const developmentRoot = createRoot();
		createFile(developmentRoot, "native/.development-mode", "win32\n");
		const source = createFile(developmentRoot, "native/windows/audio-bridge.ps1");

		expect(resolveNativeCommand("win32", [developmentRoot])).toEqual({
			executable: "powershell.exe",
			prefixArgs: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", source],
		});
	});

	it("does not implicitly fall back to staged macOS source", () => {
		const emptyRoot = createRoot();
		createFile(emptyRoot, "native/macos/main.swift");

		expect(() => resolveNativeCommand("darwin", [emptyRoot])).toThrow("Compiled macOS audio bridge not found.");
	});

	it("reports a missing compiled Windows bridge", () => {
		const emptyRoot = createRoot();

		expect(() => resolveNativeCommand("win32", [emptyRoot])).toThrow("Compiled Windows audio bridge not found.");
	});

	it("rejects development staging for a different platform", () => {
		const developmentRoot = createRoot();
		createFile(developmentRoot, "native/.development-mode", "win32\n");

		expect(() => resolveNativeCommand("darwin", [developmentRoot])).toThrow(
			"Native development mode is staged for win32, not darwin.",
		);
	});
});

describe("native plugin roots", () => {
	it("returns the packaged root, workspace plugin root, and cwd without duplicates", () => {
		const cwd = path.join(path.sep, "workspace", "apps", "audio-source");
		const moduleUrl = new URL("file:///workspace/apps/audio-source/dev.jerez.sds.audio-source.sdPlugin/bin/plugin.js")
			.href;

		expect(nativePluginRoots(moduleUrl, cwd)).toEqual([
			path.join(path.sep, "workspace", "apps", "audio-source", "dev.jerez.sds.audio-source.sdPlugin"),
			cwd,
		]);
	});
});
