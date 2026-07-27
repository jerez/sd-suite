import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const PLUGIN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RELEASE_KINDS = new Set(["rc", "stable"]);
const SHORT_SHA = /^[0-9a-f]{7,40}$/u;
const NATIVE_PLATFORMS = {
	macos: "macos-15",
	windows: "windows-2025",
};

export function toManifestVersion(version) {
	if (!STABLE_SEMVER.test(version)) {
		throw new Error(`Expected a stable semantic version, received: ${version}`);
	}
	return `${version}.0`;
}

function validatePlugin(plugin) {
	if (!PLUGIN_NAME.test(plugin.name)) {
		throw new Error(`Plugin package name must be kebab-case, received: ${plugin.name}`);
	}
	const expectedManifestVersion = toManifestVersion(plugin.version);
	if (plugin.manifestVersion !== expectedManifestVersion) {
		throw new Error(
			`${plugin.name} package version ${plugin.version} does not match manifest version ${plugin.manifestVersion}`,
		);
	}
	if (!Array.isArray(plugin.nativePlatforms)) {
		throw new Error(`${plugin.name} release.nativePlatforms must be an array`);
	}
	for (const platform of plugin.nativePlatforms) {
		if (!(platform in NATIVE_PLATFORMS)) {
			throw new Error(`${plugin.name} declares unsupported release native platform: ${platform}`);
		}
	}
	if (plugin.nativePlatforms.length > 0 && !plugin.hasReleaseNativeTask) {
		throw new Error(`${plugin.name} declares native platforms without a release:native script`);
	}
	if (plugin.nativePlatforms.length > 0 && !plugin.hasNativeStageTask) {
		throw new Error(`${plugin.name} declares native platforms without a native:stage script`);
	}
}

export function parsePluginSelection(selection, availableNames) {
	const requested = selection
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);
	if (requested.length === 0) throw new Error("Plugin selection must not be empty");
	if (requested.includes("all")) {
		if (requested.length !== 1) throw new Error("Use all by itself or select explicit plugin names");
		return [...availableNames].sort();
	}
	const seen = new Set();
	for (const name of requested) {
		if (!availableNames.includes(name)) throw new Error(`Unknown plugin: ${name}`);
		if (seen.has(name)) throw new Error(`Plugin selected more than once: ${name}`);
		seen.add(name);
	}
	return requested;
}

export function createReleaseTag({ name, version, releaseKind, shortSha }) {
	if (!RELEASE_KINDS.has(releaseKind)) throw new Error("Release kind must be rc or stable");
	if (!SHORT_SHA.test(shortSha)) throw new Error("Expected a hexadecimal Git short SHA");
	return releaseKind === "rc" ? `${name}@${version}-rc.${shortSha}` : `${name}@${version}`;
}

export function createReleasePlan({ plugins: discoveredPlugins, selection, releaseKind, shortSha }) {
	const byName = new Map();
	for (const plugin of discoveredPlugins) {
		if (byName.has(plugin.name)) {
			throw new Error(`Duplicate plugin package name: ${plugin.name}`);
		}
		byName.set(plugin.name, plugin);
	}
	const selectedNames = parsePluginSelection(selection, [...byName.keys()]);
	const plugins = [];
	const native = [];

	for (const name of selectedNames) {
		const plugin = byName.get(name);
		validatePlugin(plugin);
		const nativePlatforms = [...new Set(plugin.nativePlatforms)];
		const tag = createReleaseTag({ name: plugin.name, version: plugin.version, releaseKind, shortSha });
		plugins.push({
			hasNative: nativePlatforms.length > 0,
			installer: `${plugin.uuid}.streamDeckPlugin`,
			name: plugin.name,
			nativeArtifactPattern: `${tag}-native-*`,
			nativePlatforms,
			path: plugin.path,
			prerelease: releaseKind === "rc",
			tag,
			version: plugin.version,
		});

		for (const platform of nativePlatforms) {
			native.push({
				artifact: `${tag}-native-${platform}`,
				name: plugin.name,
				path: plugin.path,
				platform,
				runner: NATIVE_PLATFORMS[platform],
			});
		}
	}

	return { native, plugins };
}

async function findPluginManifest(pluginRoot) {
	const entries = await readdir(pluginRoot, { withFileTypes: true });
	const candidates = (
		await Promise.all(
			entries
				.filter((entry) => entry.isDirectory() && entry.name.endsWith(".sdPlugin"))
				.map(async (entry) => {
					const manifestPath = path.join(pluginRoot, entry.name, "manifest.json");
					try {
						await access(manifestPath);
						return manifestPath;
					} catch {
						return undefined;
					}
				}),
		)
	).filter(Boolean);
	if (candidates.length > 1) {
		throw new Error(`Expected exactly one .sdPlugin manifest under ${pluginRoot}`);
	}
	return candidates[0];
}

async function readPluginFromFileSystem(root, appName) {
	const pluginRoot = path.join(root, "apps", appName);
	const packagePath = path.join(pluginRoot, "package.json");
	try {
		await access(packagePath);
	} catch {
		return undefined;
	}
	const manifestPath = await findPluginManifest(pluginRoot);
	if (!manifestPath) return undefined;
	const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
	const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	return {
		hasNativeStageTask: Boolean(packageJson.scripts?.["native:stage"]),
		hasReleaseNativeTask: Boolean(packageJson.scripts?.["release:native"]),
		manifestPath,
		manifestVersion: manifest.Version,
		name: packageJson.name,
		nativePlatforms: packageJson.release?.nativePlatforms ?? [],
		path: path.relative(root, pluginRoot).split(path.sep).join("/"),
		uuid: manifest.UUID,
		version: packageJson.version,
	};
}

export async function discoverFileSystemPlugins(root) {
	const appsRoot = path.join(root, "apps");
	const entries = await readdir(appsRoot, { withFileTypes: true });
	const plugins = await Promise.all(
		entries.filter((entry) => entry.isDirectory()).map((entry) => readPluginFromFileSystem(root, entry.name)),
	);
	return plugins.filter(Boolean).sort((left, right) => left.path.localeCompare(right.path));
}

function parseArgs(args) {
	const options = { root: workspaceRoot };
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--plugins") options.selection = args[++index];
		else if (argument === "--kind") options.releaseKind = args[++index];
		else if (argument === "--sha") options.shortSha = args[++index];
		else if (argument === "--root") options.root = path.resolve(args[++index]);
		else throw new Error(`Unknown argument: ${argument}`);
	}
	if (!options.selection || !options.releaseKind || !options.shortSha) {
		throw new Error("Release planning requires --plugins, --kind, and --sha.");
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const discoveredPlugins = await discoverFileSystemPlugins(options.root);
	console.log(
		JSON.stringify(
			createReleasePlan({
				plugins: discoveredPlugins,
				selection: options.selection,
				releaseKind: options.releaseKind,
				shortSha: options.shortSha,
			}),
		),
	);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
