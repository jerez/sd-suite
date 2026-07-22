import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createReleasePlan, synchronizePluginManifestVersions, toManifestVersion } from "./plugin-release.mjs";

function plugin(overrides = {}) {
	return {
		hasNativeStageTask: true,
		hasReleaseNativeTask: true,
		manifestVersion: "1.2.3.0",
		name: "sample-plugin",
		nativePlatforms: [],
		path: "apps/sample-plugin",
		uuid: "dev.jerez.sds.sample-plugin",
		version: "1.2.3",
		...overrides,
	};
}

describe("plugin release tooling", () => {
	it("converts package semver to the four-part Stream Deck manifest version", () => {
		expect(toManifestVersion("1.2.3")).toBe("1.2.3.0");
		expect(() => toManifestVersion("1.2")).toThrow("Expected a stable semantic version");
		expect(() => toManifestVersion("1.2.3-beta.1")).toThrow("Expected a stable semantic version");
	});

	it("selects only plugins whose package version changed", () => {
		const plan = createReleasePlan({
			basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
			headPlugins: [plugin()],
		});

		expect(plan).toEqual({
			native: [],
			plugins: [
				{
					hasNative: false,
					installer: "dev.jerez.sds.sample-plugin.streamDeckPlugin",
					name: "sample-plugin",
					nativeArtifactPattern: "sample-plugin-1.2.3-native-*",
					nativePlatforms: [],
					path: "apps/sample-plugin",
					tag: "sample-plugin@1.2.3",
					version: "1.2.3",
				},
			],
		});
	});

	it("produces an empty plan when no plugin version changed", () => {
		expect(createReleasePlan({ basePlugins: [plugin()], headPlugins: [plugin()] })).toEqual({
			native: [],
			plugins: [],
		});
	});

	it("rejects a package and Stream Deck manifest version mismatch", () => {
		expect(() =>
			createReleasePlan({
				basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
				headPlugins: [plugin({ manifestVersion: "1.2.2.0" })],
			}),
		).toThrow("sample-plugin package version 1.2.3 does not match manifest version 1.2.2.0");
	});

	it("expands declared native platforms into workflow matrix entries", () => {
		const plan = createReleasePlan({
			basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
			headPlugins: [plugin({ nativePlatforms: ["macos", "windows"] })],
		});

		expect(plan.native).toEqual([
			{
				artifact: "sample-plugin-1.2.3-native-macos",
				name: "sample-plugin",
				path: "apps/sample-plugin",
				platform: "macos",
				runner: "macos-15",
			},
			{
				artifact: "sample-plugin-1.2.3-native-windows",
				name: "sample-plugin",
				path: "apps/sample-plugin",
				platform: "windows",
				runner: "windows-2025",
			},
		]);
		expect(plan.plugins[0]).toMatchObject({
			hasNative: true,
			nativePlatforms: ["macos", "windows"],
		});
	});

	it("rejects unsupported release native platforms", () => {
		expect(() =>
			createReleasePlan({
				basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
				headPlugins: [plugin({ nativePlatforms: ["linux"] })],
			}),
		).toThrow("sample-plugin declares unsupported release native platform: linux");
	});

	it("rejects malformed release native platform configuration", () => {
		expect(() =>
			createReleasePlan({
				basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
				headPlugins: [plugin({ nativePlatforms: "macos" })],
			}),
		).toThrow("sample-plugin release.nativePlatforms must be an array");
	});

	it("rejects a plugin version that does not increase", () => {
		expect(() =>
			createReleasePlan({
				basePlugins: [plugin()],
				headPlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
			}),
		).toThrow("sample-plugin version must increase from 1.2.3 to 1.2.2");
	});

	it("rejects native plugins without the package-owned release task", () => {
		expect(() =>
			createReleasePlan({
				basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
				headPlugins: [plugin({ hasReleaseNativeTask: false, nativePlatforms: ["macos"] })],
			}),
		).toThrow("sample-plugin declares native platforms without a release:native script");
	});

	it("rejects native plugins without the package-owned staging task", () => {
		expect(() =>
			createReleasePlan({
				basePlugins: [plugin({ version: "1.2.2", manifestVersion: "1.2.2.0" })],
				headPlugins: [plugin({ hasNativeStageTask: false, nativePlatforms: ["macos"] })],
			}),
		).toThrow("sample-plugin declares native platforms without a native:stage script");
	});

	it("synchronizes plugin manifests with package versions", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "sd-suite-release-test-"));
		const pluginRoot = path.join(root, "apps", "sample-plugin");
		const manifestRoot = path.join(pluginRoot, "dev.jerez.sds.sample-plugin.sdPlugin");

		try {
			await mkdir(manifestRoot, { recursive: true });
			await writeFile(
				path.join(pluginRoot, "package.json"),
				`${JSON.stringify({ name: "sample-plugin", private: true, version: "1.2.3" }, null, 2)}\n`,
			);
			await writeFile(
				path.join(manifestRoot, "manifest.json"),
				`${JSON.stringify({ UUID: "dev.jerez.sds.sample-plugin", Version: "1.2.2.0" }, null, 2)}\n`,
			);

			await expect(synchronizePluginManifestVersions(root)).resolves.toEqual([
				{
					manifestPath: "apps/sample-plugin/dev.jerez.sds.sample-plugin.sdPlugin/manifest.json",
					name: "sample-plugin",
					version: "1.2.3.0",
				},
			]);
			const manifest = JSON.parse(await readFile(path.join(manifestRoot, "manifest.json"), "utf8"));
			expect(manifest.Version).toBe("1.2.3.0");
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
