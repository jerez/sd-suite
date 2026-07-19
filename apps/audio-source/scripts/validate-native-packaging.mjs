#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PLUGIN_DIR = "dev.jerez.sds.audio-source.sdPlugin";
const PACKAGE_FILE = "dev.jerez.sds.audio-source.streamDeckPlugin";
const REQUIRED_FILES = ["layouts/output-device.json", "native/macos/audio-bridge", "native/windows/audio-bridge.exe"];
const FORBIDDEN_NATIVE_SUFFIXES = [".swift", ".cs", ".ps1", ".csproj", ".pdb"];
const FORBIDDEN_NATIVE_NAMES = ["native/.development-mode"];

const packagePath = resolve(PACKAGE_FILE);

if (!existsSync(packagePath)) {
	console.error(`Package not found: ${PACKAGE_FILE}`);
	process.exit(1);
}

let archiveEntries;

try {
	archiveEntries = new Set(
		execFileSync("unzip", ["-Z1", packagePath], { encoding: "utf8" }).split(/\r?\n/u).filter(Boolean),
	);
} catch {
	console.error(`Unable to read package: ${PACKAGE_FILE}`);
	process.exit(1);
}

const missingFiles = REQUIRED_FILES.filter((relativePath) => !archiveEntries.has(`${PLUGIN_DIR}/${relativePath}`));
const forbiddenFiles = [...archiveEntries]
	.filter((entry) => entry.startsWith(`${PLUGIN_DIR}/native/`))
	.map((entry) => entry.slice(`${PLUGIN_DIR}/`.length))
	.filter(
		(relativePath) =>
			FORBIDDEN_NATIVE_NAMES.includes(relativePath) ||
			FORBIDDEN_NATIVE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix)),
	);

if (missingFiles.length > 0 || forbiddenFiles.length > 0) {
	for (const relativePath of missingFiles) {
		console.error(`Missing package entry: ${relativePath}`);
	}
	for (const relativePath of forbiddenFiles) {
		console.error(`Forbidden package entry: ${relativePath}`);
	}
	process.exit(1);
}

console.log("Required compiled native package assets are present.");
