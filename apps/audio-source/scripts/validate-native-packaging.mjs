#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PLUGIN_DIR = "dev.jerez.sds.audio-source.sdPlugin";
const PACKAGE_FILE = "dev.jerez.sds.audio-source.streamDeckPlugin";
const REQUIRED_FILES = [
	"layouts/output-device.json",
	"native/mac/audio-bridge.swift",
	"native/windows/audio-bridge.ps1",
	"native/windows/audio-bridge.cs",
];

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

if (missingFiles.length > 0) {
	for (const relativePath of missingFiles) {
		console.error(`Missing package entry: ${relativePath}`);
	}
	process.exit(1);
}

console.log("Required package assets are present.");
