import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executable =
	process.platform === "darwin"
		? path.join(packageRoot, ".native/macos/audio-bridge")
		: process.platform === "win32"
			? path.join(packageRoot, ".native/windows/audio-bridge.exe")
			: null;

if (!executable) throw new Error(`Unsupported native test platform: ${process.platform}`);

const stdout = execFileSync(executable, ["self-test", "output"], { encoding: "utf8" });
const line = stdout
	.split(/\r?\n/u)
	.map((entry) => entry.trim())
	.filter(Boolean)
	.at(-1);
const response = JSON.parse(line ?? "null");
if (
	response?.defaultId !== "self-test" ||
	response?.devices?.length !== 1 ||
	response.devices[0]?.id !== "self-test" ||
	response.devices[0]?.name !== "Audio Bridge Self Test"
) {
	throw new Error(`Unexpected native self-test response: ${line ?? "<empty>"}`);
}

console.log("Native bridge self-test passed.");
