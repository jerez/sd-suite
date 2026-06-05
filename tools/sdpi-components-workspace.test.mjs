import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const sdpiPackagePath = path.join(workspaceRoot, "packages/sdpi-components/package.json");
const sdpiEntryPath = path.join(workspaceRoot, "packages/sdpi-components/sdpi-components.js");
const controlMeshPackagePath = path.join(workspaceRoot, "apps/control-mesh/package.json");
const controlMeshRollupConfigPath = path.join(workspaceRoot, "apps/control-mesh/rollup.config.mjs");

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

describe("shared sdpi-components workspace package", () => {
	it("centralizes the pinned SDPI component asset for plugin builds", () => {
		expect(existsSync(sdpiPackagePath)).toBe(true);

		const sdpiPackage = readJson(sdpiPackagePath);
		const controlMeshPackage = readJson(controlMeshPackagePath);
		const controlMeshRollupConfig = readFileSync(controlMeshRollupConfigPath, "utf8");

		expect(sdpiPackage.name).toBe("@workspace/sdpi-components");
		expect(sdpiPackage.version).toBe("4.0.1");
		expect(existsSync(sdpiEntryPath)).toBe(true);
		expect(sdpiPackage.exports["./sdpi-components.js"]).toBe("./sdpi-components.js");
		expect(sdpiPackage.dependencies["sdpi-components"]).toBe("github:GeekyEggo/sdpi-components#v4.0.1");
		expect(controlMeshPackage.devDependencies["@workspace/sdpi-components"]).toBe("workspace:*");
		expect(controlMeshPackage.scripts.build).toBe("rollup -c");
		expect(controlMeshRollupConfig).toContain('"ui/sdpi-components": sdpiComponentsEntry');
		expect(controlMeshRollupConfig).toContain('require.resolve("@workspace/sdpi-components/sdpi-components.js")');
	});
});
