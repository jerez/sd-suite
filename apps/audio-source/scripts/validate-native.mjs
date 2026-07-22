import { execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const universal = process.argv.includes("--universal");

if (process.platform === "darwin") {
	const executable = path.join(packageRoot, ".native/macos/audio-bridge");
	await access(executable);
	const metadata = await stat(executable);
	if ((metadata.mode & 0o111) === 0) throw new Error("macOS audio bridge is not executable.");
	if (universal) {
		const architectures = execFileSync("lipo", ["-archs", executable], { encoding: "utf8" }).trim().split(/\s+/u);
		for (const required of ["arm64", "x86_64"]) {
			if (!architectures.includes(required)) {
				throw new Error(`macOS release bridge is missing ${required}.`);
			}
		}
	}
} else if (process.platform === "win32") {
	if (universal) throw new Error("--universal is supported only on macOS.");
	const executable = path.join(packageRoot, ".native/windows/audio-bridge.exe");
	const header = await readFile(executable);
	if (header.subarray(0, 2).toString("ascii") !== "MZ") {
		throw new Error("Windows audio bridge is not a PE executable.");
	}
} else {
	throw new Error(`Unsupported native validation platform: ${process.platform}`);
}

console.log("Native bridge output is valid.");
