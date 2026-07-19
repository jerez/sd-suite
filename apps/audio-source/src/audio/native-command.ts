import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type NativePlatform = "darwin" | "win32";
export type NativeCommand = { executable: string; prefixArgs: string[] };

const PLUGIN_DIRECTORY = "dev.jerez.sds.audio-source.sdPlugin";

export function nativePluginRoots(moduleUrl: string, cwd = process.cwd()): string[] {
	const moduleDirectory = path.dirname(fileURLToPath(moduleUrl));
	return [...new Set([path.resolve(moduleDirectory, ".."), path.resolve(cwd, PLUGIN_DIRECTORY), path.resolve(cwd)])];
}

export function resolveNativeCommand(platform: NativePlatform, roots: string[]): NativeCommand {
	for (const root of roots) {
		const marker = path.join(root, "native/.development-mode");
		if (!existsSync(marker)) {
			continue;
		}

		const stagedPlatform = readFileSync(marker, "utf8").trim();
		if (stagedPlatform !== platform) {
			throw new Error(`Native development mode is staged for ${stagedPlatform}, not ${platform}.`);
		}

		if (platform === "darwin") {
			const source = path.join(root, "native/macos/main.swift");
			if (!existsSync(source)) {
				throw new Error("Staged macOS development bridge source not found.");
			}
			return { executable: "/usr/bin/swift", prefixArgs: [source] };
		}

		const source = path.join(root, "native/windows/audio-bridge.ps1");
		if (!existsSync(source)) {
			throw new Error("Staged Windows development bridge source not found.");
		}
		return {
			executable: "powershell.exe",
			prefixArgs: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", source],
		};
	}

	const relativeExecutable = platform === "darwin" ? "native/macos/audio-bridge" : "native/windows/audio-bridge.exe";
	for (const root of roots) {
		const executable = path.join(root, relativeExecutable);
		if (existsSync(executable)) {
			return { executable, prefixArgs: [] };
		}
	}

	throw new Error(
		platform === "darwin" ? "Compiled macOS audio bridge not found." : "Compiled Windows audio bridge not found.",
	);
}
