import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	createReleasePlan,
	createReleaseTag,
	discoverFileSystemPlugins,
	parsePluginSelection,
	toManifestVersion,
} from "./plugin-release.mjs";

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

async function writePlugin(
	root,
	directory,
	{ manifests = ["dev.jerez.sds.sample-plugin.sdPlugin"], name = directory } = {},
) {
	const pluginRoot = path.join(root, "apps", directory);
	await mkdir(pluginRoot, { recursive: true });
	await writeFile(path.join(pluginRoot, "package.json"), JSON.stringify({ name, version: "1.2.3" }));
	for (const manifestDirectory of manifests) {
		await mkdir(path.join(pluginRoot, manifestDirectory), { recursive: true });
		await writeFile(
			path.join(pluginRoot, manifestDirectory, "manifest.json"),
			JSON.stringify({ UUID: `dev.jerez.sds.${directory}`, Version: "1.2.3.0" }),
		);
	}
}

describe("plugin release tooling", () => {
	it("converts package semver to the four-part Stream Deck manifest version", () => {
		expect(toManifestVersion("1.2.3")).toBe("1.2.3.0");
		expect(() => toManifestVersion("1.2")).toThrow("Expected a stable semantic version");
		expect(() => toManifestVersion("1.2.3-beta.1")).toThrow("Expected a stable semantic version");
	});

	it("parses one, multiple, and all plugin selections", () => {
		expect(parsePluginSelection("sample-plugin", ["other-plugin", "sample-plugin"])).toEqual(["sample-plugin"]);
		expect(parsePluginSelection("other-plugin, sample-plugin", ["other-plugin", "sample-plugin"])).toEqual([
			"other-plugin",
			"sample-plugin",
		]);
		expect(parsePluginSelection("all", ["sample-plugin", "other-plugin"])).toEqual(["other-plugin", "sample-plugin"]);
	});

	it("rejects empty, unknown, duplicate, and mixed all selections", () => {
		expect(() => parsePluginSelection("", ["sample-plugin"])).toThrow("Plugin selection must not be empty");
		expect(() => parsePluginSelection("missing", ["sample-plugin"])).toThrow("Unknown plugin: missing");
		expect(() => parsePluginSelection("sample-plugin,sample-plugin", ["sample-plugin"])).toThrow(
			"Plugin selected more than once: sample-plugin",
		);
		expect(() => parsePluginSelection("all,sample-plugin", ["sample-plugin"])).toThrow(
			"Use all by itself or select explicit plugin names",
		);
	});

	it("creates immutable RC and stable release identities", () => {
		expect(
			createReleaseTag({
				name: "sample-plugin",
				version: "1.2.3",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toBe("sample-plugin@1.2.3-rc.edb0c41");
		expect(
			createReleaseTag({
				name: "sample-plugin",
				version: "1.2.3",
				releaseKind: "stable",
				shortSha: "edb0c41",
			}),
		).toBe("sample-plugin@1.2.3");
	});

	it("rejects invalid release kinds and short SHAs", () => {
		expect(() =>
			createReleaseTag({
				name: "sample-plugin",
				version: "1.2.3",
				releaseKind: "preview",
				shortSha: "edb0c41",
			}),
		).toThrow("Release kind must be rc or stable");
		expect(() =>
			createReleaseTag({
				name: "sample-plugin",
				version: "1.2.3",
				releaseKind: "rc",
				shortSha: "not-a-sha",
			}),
		).toThrow("Expected a hexadecimal Git short SHA");
	});

	it("plans RC and stable releases from explicit plugin selection", () => {
		const plan = createReleasePlan({
			plugins: [plugin()],
			selection: "sample-plugin",
			releaseKind: "rc",
			shortSha: "edb0c41",
		});

		expect(plan.plugins[0]).toMatchObject({
			name: "sample-plugin",
			prerelease: true,
			tag: "sample-plugin@1.2.3-rc.edb0c41",
			version: "1.2.3",
		});
		expect(
			createReleasePlan({
				plugins: [plugin()],
				selection: "sample-plugin",
				releaseKind: "stable",
				shortSha: "edb0c41",
			}).plugins[0],
		).toMatchObject({ prerelease: false, tag: "sample-plugin@1.2.3" });
	});

	it("rejects a package and Stream Deck manifest version mismatch", () => {
		expect(() =>
			createReleasePlan({
				plugins: [plugin({ manifestVersion: "1.2.2.0" })],
				selection: "sample-plugin",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toThrow("sample-plugin package version 1.2.3 does not match manifest version 1.2.2.0");
	});

	it("rejects duplicate discovered package names", () => {
		expect(() =>
			createReleasePlan({
				plugins: [plugin({ path: "apps/first" }), plugin({ path: "apps/second" })],
				selection: "all",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toThrow("Duplicate plugin package name: sample-plugin");
	});

	it("discovers plugins while skipping non-plugin app directories", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "plugin-release-"));
		await mkdir(path.join(root, "apps", "web"), { recursive: true });
		await writeFile(path.join(root, "apps", "web", "package.json"), JSON.stringify({ name: "web" }));
		await mkdir(path.join(root, "apps", "notes"), { recursive: true });
		await writePlugin(root, "sample-plugin");
		await mkdir(path.join(root, "apps", "sample-plugin", "empty.sdPlugin"));

		const plugins = await discoverFileSystemPlugins(root);

		expect(plugins.map(({ name, path: pluginPath }) => ({ name, path: pluginPath }))).toEqual([
			{ name: "sample-plugin", path: "apps/sample-plugin" },
		]);
	});

	it("rejects app directories with a package and multiple plugin manifests", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "plugin-release-"));
		await writePlugin(root, "ambiguous", {
			manifests: ["one.sdPlugin", "two.sdPlugin"],
		});

		await expect(discoverFileSystemPlugins(root)).rejects.toThrow("Expected exactly one .sdPlugin manifest under");
	});

	it("expands declared native platforms into workflow matrix entries", () => {
		const plan = createReleasePlan({
			plugins: [plugin({ nativePlatforms: ["macos", "windows"] })],
			selection: "sample-plugin",
			releaseKind: "rc",
			shortSha: "edb0c41",
		});

		expect(plan.native).toEqual([
			{
				artifact: "sample-plugin@1.2.3-rc.edb0c41-native-macos",
				name: "sample-plugin",
				path: "apps/sample-plugin",
				platform: "macos",
				runner: "macos-15",
			},
			{
				artifact: "sample-plugin@1.2.3-rc.edb0c41-native-windows",
				name: "sample-plugin",
				path: "apps/sample-plugin",
				platform: "windows",
				runner: "windows-2025",
			},
		]);
		expect(plan.plugins[0]).toMatchObject({
			hasNative: true,
			nativeArtifactPattern: "sample-plugin@1.2.3-rc.edb0c41-native-*",
			nativePlatforms: ["macos", "windows"],
		});
	});

	it("rejects unsupported release native platforms", () => {
		expect(() =>
			createReleasePlan({
				plugins: [plugin({ nativePlatforms: ["linux"] })],
				selection: "sample-plugin",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toThrow("sample-plugin declares unsupported release native platform: linux");
	});

	it("rejects malformed release native platform configuration", () => {
		expect(() =>
			createReleasePlan({
				plugins: [plugin({ nativePlatforms: "macos" })],
				selection: "sample-plugin",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toThrow("sample-plugin release.nativePlatforms must be an array");
	});

	it("rejects native plugins without the package-owned release task", () => {
		expect(() =>
			createReleasePlan({
				plugins: [plugin({ hasReleaseNativeTask: false, nativePlatforms: ["macos"] })],
				selection: "sample-plugin",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toThrow("sample-plugin declares native platforms without a release:native script");
	});

	it("rejects native plugins without the package-owned staging task", () => {
		expect(() =>
			createReleasePlan({
				plugins: [plugin({ hasNativeStageTask: false, nativePlatforms: ["macos"] })],
				selection: "sample-plugin",
				releaseKind: "rc",
				shortSha: "edb0c41",
			}),
		).toThrow("sample-plugin declares native platforms without a native:stage script");
	});
});
