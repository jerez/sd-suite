import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import url from "node:url";

type UiPackageManifest = {
	exports: Record<string, string>;
	sideEffects: string[];
};

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(dirname, "../package.json");

async function readPackageManifest(): Promise<UiPackageManifest> {
	return JSON.parse(await readFile(packageJsonPath, "utf8")) as UiPackageManifest;
}

describe("@workspace/ui package manifest", () => {
	it("marks only stylesheet imports as side-effectful", async () => {
		await expect(readPackageManifest()).resolves.toMatchObject({
			sideEffects: ["**/*.css"],
		});
	});

	it("exposes per-file subpaths instead of a package barrel", async () => {
		const manifest = await readPackageManifest();

		expect(manifest.exports).toEqual({
			"./components/*": "./src/components/*.tsx",
			"./globals.css": "./src/styles/globals.css",
			"./hooks/*": "./src/hooks/*.ts",
			"./lib/*": "./src/lib/*.ts",
		});
		expect(Object.hasOwn(manifest.exports, ".")).toBe(false);
	});
});
