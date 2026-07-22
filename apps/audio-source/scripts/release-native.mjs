import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));

export function releaseNativeSteps(platform) {
	if (platform === "darwin") {
		return [["build-native.mjs", "--universal"], ["validate-native.mjs", "--universal"], ["test-native.mjs"]];
	}
	if (platform === "win32") {
		return [
			["build-native.mjs"],
			["validate-native.mjs"],
			["test-native.mjs"],
			["test-native-windows-integration.mjs"],
		];
	}
	throw new Error(`Unsupported native release platform: ${platform}`);
}

export function runReleaseNative(platform = process.platform) {
	for (const [script, ...args] of releaseNativeSteps(platform)) {
		execFileSync(process.execPath, [path.join(scriptsRoot, script), ...args], { stdio: "inherit" });
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	runReleaseNative();
}
