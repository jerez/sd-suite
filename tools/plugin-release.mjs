import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const PLUGIN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
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

function compareVersions(left, right) {
	const leftParts = left.split(".").map(Number);
	const rightParts = right.split(".").map(Number);
	for (let index = 0; index < leftParts.length; index += 1) {
		if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
	}
	return 0;
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

export function createReleasePlan({ basePlugins, headPlugins }) {
	const baseByPath = new Map(basePlugins.map((plugin) => [plugin.path, plugin]));
	const plugins = [];
	const native = [];

	for (const plugin of [...headPlugins].sort((left, right) => left.path.localeCompare(right.path))) {
		validatePlugin(plugin);
		const basePlugin = baseByPath.get(plugin.path);
		if (!basePlugin || basePlugin.version === plugin.version) continue;
		toManifestVersion(basePlugin.version);
		if (compareVersions(plugin.version, basePlugin.version) <= 0) {
			throw new Error(`${plugin.name} version must increase from ${basePlugin.version} to ${plugin.version}`);
		}

		const nativePlatforms = [...new Set(plugin.nativePlatforms)];
		const releasePlugin = {
			hasNative: nativePlatforms.length > 0,
			installer: `${plugin.uuid}.streamDeckPlugin`,
			name: plugin.name,
			nativeArtifactPattern: `${plugin.name}-${plugin.version}-native-*`,
			nativePlatforms,
			path: plugin.path,
			tag: `${plugin.name}@${plugin.version}`,
			version: plugin.version,
		};
		plugins.push(releasePlugin);

		for (const platform of nativePlatforms) {
			native.push({
				artifact: `${plugin.name}-${plugin.version}-native-${platform}`,
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
	const candidates = entries
		.filter((entry) => entry.isDirectory() && entry.name.endsWith(".sdPlugin"))
		.map((entry) => path.join(pluginRoot, entry.name, "manifest.json"));
	if (candidates.length !== 1) {
		throw new Error(`Expected exactly one .sdPlugin manifest under ${pluginRoot}`);
	}
	return candidates[0];
}

async function readPluginFromFileSystem(root, appName) {
	const pluginRoot = path.join(root, "apps", appName);
	const packagePath = path.join(pluginRoot, "package.json");
	const manifestPath = await findPluginManifest(pluginRoot);
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

async function discoverFileSystemPlugins(root) {
	const appsRoot = path.join(root, "apps");
	const entries = await readdir(appsRoot, { withFileTypes: true });
	const plugins = await Promise.all(
		entries.filter((entry) => entry.isDirectory()).map((entry) => readPluginFromFileSystem(root, entry.name)),
	);
	return plugins.sort((left, right) => left.path.localeCompare(right.path));
}

export async function synchronizePluginManifestVersions(root = workspaceRoot) {
	const plugins = await discoverFileSystemPlugins(root);
	const updates = [];
	for (const plugin of plugins) {
		const version = toManifestVersion(plugin.version);
		if (plugin.manifestVersion === version) continue;
		const manifest = JSON.parse(await readFile(plugin.manifestPath, "utf8"));
		manifest.Version = version;
		await writeFile(plugin.manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
		updates.push({
			manifestPath: path.relative(root, plugin.manifestPath).split(path.sep).join("/"),
			name: plugin.name,
			version,
		});
	}
	return updates;
}

function git(root, args) {
	return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function readJsonAtRef(root, ref, filePath) {
	return JSON.parse(git(root, ["show", `${ref}:${filePath}`]));
}

function listFilesAtRef(root, ref) {
	const output = git(root, ["ls-tree", "-r", "--name-only", ref, "--", "apps"]);
	return output ? output.split("\n") : [];
}

function discoverPluginsAtRef(root, ref) {
	const files = listFilesAtRef(root, ref);
	const packagePaths = files.filter((filePath) => /^apps\/[^/]+\/package\.json$/u.test(filePath));
	return packagePaths.map((packagePath) => {
		const pluginPath = path.posix.dirname(packagePath);
		const manifestPaths = files.filter(
			(filePath) => filePath.startsWith(`${pluginPath}/`) && /\.sdPlugin\/manifest\.json$/u.test(filePath),
		);
		if (manifestPaths.length !== 1) {
			throw new Error(`Expected exactly one .sdPlugin manifest under ${pluginPath} at ${ref}`);
		}
		const packageJson = readJsonAtRef(root, ref, packagePath);
		const manifest = readJsonAtRef(root, ref, manifestPaths[0]);
		return {
			hasNativeStageTask: Boolean(packageJson.scripts?.["native:stage"]),
			hasReleaseNativeTask: Boolean(packageJson.scripts?.["release:native"]),
			manifestVersion: manifest.Version,
			name: packageJson.name,
			nativePlatforms: packageJson.release?.nativePlatforms ?? [],
			path: pluginPath,
			uuid: manifest.UUID,
			version: packageJson.version,
		};
	});
}

function parseArgs(args) {
	const options = { root: workspaceRoot };
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--sync-manifests") options.syncManifests = true;
		else if (argument === "--base") options.base = args[++index];
		else if (argument === "--head") options.head = args[++index];
		else if (argument === "--root") options.root = path.resolve(args[++index]);
		else throw new Error(`Unknown argument: ${argument}`);
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.syncManifests) {
		const updates = await synchronizePluginManifestVersions(options.root);
		console.log(JSON.stringify({ updated: updates }));
		return;
	}
	if (!options.base || !options.head) {
		throw new Error("Release planning requires --base and --head refs.");
	}
	const plan = createReleasePlan({
		basePlugins: discoverPluginsAtRef(options.root, options.base),
		headPlugins: discoverPluginsAtRef(options.root, options.head),
	});
	console.log(JSON.stringify(plan));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
