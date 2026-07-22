import * as path from "node:path";
import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const requireFromScript = createRequire(import.meta.url);
const cliPackagePath = requireFromScript.resolve("@elgato/cli/package.json");
const requireFromCli = createRequire(cliPackagePath);
// pnpm does not expose transitive dependencies to this root script, so resolve
// EJS from the package that owns the Elgato template dependency.
const ejs = requireFromCli("ejs");

const reverseDnsRoot = "dev.jerez.sds";
const streamDeckSdkVersion = "2.1.0";
const usage = [
	"Usage: pnpm plugin:create <plugin-name> [options]",
	"",
	"Options:",
	"  --author <name>          Manifest author. Defaults to package author or Jerez.",
	"  --description <text>     Manifest description.",
	"  --display-name <name>    Manifest display name. Defaults to title-cased plugin name.",
	"  --dry-run                Validate inputs and print the scaffold plan without writing files.",
	"  --root <path>            Workspace root. Defaults to the current directory.",
	"  -h, --help               Show this help.",
].join("\n");

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		console.log(usage);
		return;
	}

	const context = await buildContext(options);

	if (options.dryRun) {
		printPlan(context);
		return;
	}

	const { readmePath } = await createPlugin(context);

	console.log(`Created ${context.pluginName} plugin scaffold at ${relativePath(context.rootDir, context.appDir)}`);
	console.log(`Plugin UUID: ${context.uuid}`);
	console.log(`Plugin README: ${relativePath(context.rootDir, readmePath)}`);

	console.log("Next steps:");
	console.log("  pnpm install");
	console.log("  pnpm plugin:validate");
}

/**
 * Create one plugin package from the pinned Elgato template and adapt it to the
 * workspace layout.
 *
 * @param {Awaited<ReturnType<typeof buildContext>>} context Scaffold context.
 * @returns {Promise<{ readmePath: string }>} Paths for generated workspace-owned files.
 */
export async function createPlugin(context) {
	await ensureAvailablePath(context.appDir);
	await ensureTemplateShape(context.templateDir);
	await copyTemplate(context.templateDir, context.appDir, context);
	await adaptPackageJson(context);
	await adaptTsConfig(context);
	const readmePath = await writePluginReadme(context);

	return { readmePath };
}

/**
 * Parse the small command surface reserved for workspace plugin scaffolding.
 *
 * @param {string[]} args CLI arguments after the script path.
 * @returns {{
 *   author?: string;
 *   description?: string;
 *   displayName?: string;
 *   dryRun: boolean;
 *   help: boolean;
 *   pluginName?: string;
 *   root: string;
 * }}
 */
export function parseArgs(args) {
	const options = {
		dryRun: false,
		help: false,
		root: process.cwd(),
	};
	const positional = [];

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === "-h" || arg === "--help") {
			options.help = true;
			continue;
		}

		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}

		if (arg === "--author" || arg === "--description" || arg === "--display-name" || arg === "--root") {
			const value = args[index + 1];

			if (value === undefined || value.startsWith("--")) {
				throw new Error(`Missing value for ${arg}.\n\n${usage}`);
			}

			options[toOptionKey(arg)] = value;
			index += 1;
			continue;
		}

		if (arg.startsWith("--")) {
			throw new Error(`Unknown option: ${arg}\n\n${usage}`);
		}

		positional.push(arg);
	}

	if (options.help) {
		return options;
	}

	if (positional.length !== 1) {
		throw new Error(`Expected one plugin name.\n\n${usage}`);
	}

	options.pluginName = positional[0];
	return options;
}

function toOptionKey(arg) {
	return arg.replace(/^--/, "").replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Build the complete scaffold context from CLI options and workspace package
 * metadata.
 *
 * @param {ReturnType<typeof parseArgs>} options Parsed CLI options.
 * @returns {Promise<object>} Template and path data for one plugin scaffold.
 */
export async function buildContext(options) {
	const rootDir = path.resolve(options.root);
	const rootPackage = await readJson(path.join(rootDir, "package.json"));
	const pluginName = normalizePluginName(options.pluginName);
	const displayName = options.displayName ?? titleCase(pluginName);
	const uuid = `${reverseDnsRoot}.${pluginName}`;
	const sdPluginDirName = `${uuid}.sdPlugin`;
	const appDir = path.join(rootDir, "apps", pluginName);
	const cliPackage = await readJson(cliPackagePath);
	const templateDir = path.join(path.dirname(cliPackagePath), "template");
	const cliVersion = rootPackage.devDependencies?.["@elgato/cli"] ?? cliPackage.version;

	return {
		appDir,
		author: options.author ?? getPackageAuthor(rootPackage) ?? "Jerez",
		description: options.description ?? `Stream Deck plugin for ${displayName}.`,
		displayName,
		pluginName,
		rootDir,
		rootPackage,
		sdPluginDirName,
		templateData: {
			author: options.author ?? getPackageAuthor(rootPackage) ?? "Jerez",
			description: options.description ?? `Stream Deck plugin for ${displayName}.`,
			isPreBuild: false,
			name: displayName,
			npm: {
				cli: cliVersion,
				streamDeck: streamDeckSdkVersion,
			},
			uuid,
		},
		templateDir,
		uuid,
	};
}

/**
 * Enforce the workspace plugin name contract before deriving package and
 * Stream Deck identifiers from it.
 *
 * @param {string} name User-provided plugin name.
 * @returns {string} Normalized plugin name.
 */
export function normalizePluginName(name) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
		throw new Error("Plugin name must be kebab-case with lowercase letters, numbers, and single hyphen separators.");
	}

	return name;
}

/**
 * Convert a kebab-case package name to the default Stream Deck display name.
 *
 * @param {string} name Kebab-case plugin name.
 * @returns {string} Title-cased display name.
 */
export function titleCase(name) {
	return name
		.split("-")
		.map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function getPackageAuthor(packageJson) {
	if (typeof packageJson.author === "string") {
		return packageJson.author;
	}

	if (typeof packageJson.author?.name === "string") {
		return packageJson.author.name;
	}

	return undefined;
}

async function ensureAvailablePath(targetPath) {
	if (await pathExists(targetPath)) {
		throw new Error(`Refusing to overwrite existing path: ${targetPath}`);
	}
}

async function ensureTemplateShape(templateDir) {
	const requiredPaths = [
		"package.json.ejs",
		"rollup.config.mjs.ejs",
		"src/plugin.ts",
		"tsconfig.json.ejs",
		"com.elgato.template.sdPlugin/manifest.json.ejs",
	];

	for (const requiredPath of requiredPaths) {
		const absolutePath = path.join(templateDir, requiredPath);

		if (!(await pathExists(absolutePath))) {
			throw new Error(`Elgato CLI template is missing expected file: ${requiredPath}`);
		}
	}
}

async function copyTemplate(sourceDir, targetDir, context) {
	await mkdir(targetDir, { recursive: true });

	for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
		// Editor settings are intentionally workspace-owned in this monorepo.
		if (entry.name === ".vscode") {
			continue;
		}

		const sourcePath = path.join(sourceDir, entry.name);
		const targetName = mapTemplateName(entry.name, context);
		const targetPath = path.join(targetDir, targetName);

		if (entry.isDirectory()) {
			await copyTemplate(sourcePath, targetPath, context);
			continue;
		}

		if (entry.isFile()) {
			await writeTemplateFile(sourcePath, targetPath, context);
		}
	}
}

/**
 * Adapt Elgato template file names to this workspace's plugin naming scheme.
 *
 * @param {string} name Template file or directory name.
 * @param {{ sdPluginDirName: string }} context Scaffold context.
 * @returns {string} Target file or directory name.
 */
export function mapTemplateName(name, context) {
	if (name === "com.elgato.template.sdPlugin") {
		return context.sdPluginDirName;
	}

	if (name === "_.gitignore") {
		return ".gitignore";
	}

	if (name.endsWith(".ejs")) {
		return name.slice(0, -4);
	}

	return name;
}

async function writeTemplateFile(sourcePath, targetPath, context) {
	await mkdir(path.dirname(targetPath), { recursive: true });

	if (sourcePath.endsWith(".ejs")) {
		const source = await readFile(sourcePath, "utf8");
		const rendered = ejs.render(source, context.templateData, { filename: sourcePath });
		await writeFile(targetPath, rendered);
		return;
	}

	await copyFile(sourcePath, targetPath);
}

async function adaptPackageJson(context) {
	const packagePath = path.join(context.appDir, "package.json");
	const generated = await readJson(packagePath);
	const rootDevDependencies = context.rootPackage.devDependencies ?? {};
	const devDependencies = {
		...generated.devDependencies,
		"@types/node": rootDevDependencies["@types/node"] ?? generated.devDependencies["@types/node"],
		typescript: rootDevDependencies.typescript ?? generated.devDependencies.typescript,
	};

	delete devDependencies["@tsconfig/node20"];

	await writeJson(packagePath, {
		name: context.pluginName,
		private: true,
		version: "0.0.0",
		type: generated.type,
		scripts: {
			build: generated.scripts.build,
			watch: generated.scripts.watch,
			dev: "streamdeck dev",
			link: `streamdeck link ${context.sdPluginDirName}`,
			restart: `streamdeck restart ${context.uuid}`,
			validate: `streamdeck validate ${context.sdPluginDirName} --no-update-check`,
			pack: `streamdeck pack ${context.sdPluginDirName} --no-update-check`,
			typecheck: "tsc --noEmit",
			lint: "eslint . --max-warnings 0",
			test: "vitest run --passWithNoTests",
		},
		dependencies: generated.dependencies,
		devDependencies,
	});
}

async function adaptTsConfig(context) {
	const tsconfigPath = path.join(context.appDir, "tsconfig.json");
	const generated = await readJson(tsconfigPath);

	await writeJson(tsconfigPath, {
		extends: "../../tsconfig.base.json",
		compilerOptions: generated.compilerOptions,
		include: generated.include,
		exclude: generated.exclude,
	});
}

async function writePluginReadme(context) {
	const readmePath = path.join(context.appDir, "README.md");

	await writeFile(readmePath, renderPluginReadme(context));

	return readmePath;
}

/**
 * Render the initial plugin README from scaffold metadata only.
 *
 * @param {Awaited<ReturnType<typeof buildContext>>} context Scaffold context.
 * @returns {string} Placeholder README content for the generated plugin package.
 */
export function renderPluginReadme(context) {
	return [
		`# ${context.displayName}`,
		"",
		"Generated Stream Deck plugin scaffold.",
		"",
		"This placeholder is generated from scaffold metadata. Replace it with plugin-specific documentation when implementation begins.",
		"",
		"## Scaffold Metadata",
		"",
		`- Package: \`${context.pluginName}\``,
		`- Display name: \`${context.displayName}\``,
		`- Description: \`${context.description}\``,
		`- Author: \`${context.author}\``,
		`- Plugin UUID: \`${context.uuid}\``,
		`- Plugin folder: \`${context.sdPluginDirName}\``,
		`- Stream Deck SDK: \`@elgato/streamdeck ${context.templateData.npm.streamDeck}\``,
		`- Elgato CLI: \`@elgato/cli ${context.templateData.npm.cli}\``,
		"",
		"## Commands",
		"",
		"```sh",
		"pnpm build",
		"pnpm dev",
		"pnpm validate",
		"pnpm pack",
		"pnpm test",
		"```",
		"",
		"Declare shipped changes from the workspace root with `pnpm changeset`.",
		"The shared release workflow packages this plugin only after a reviewed version pull request increases its package version.",
		"",
	].join("\n");
}

function printPlan(context) {
	console.log(`Plugin name: ${context.pluginName}`);
	console.log(`Display name: ${context.displayName}`);
	console.log(`Plugin UUID: ${context.uuid}`);
	console.log(`Target path: ${relativePath(context.rootDir, context.appDir)}`);
	console.log(`Template path: ${relativePath(context.rootDir, context.templateDir)}`);
	console.log(`SDK dependency: @elgato/streamdeck ${streamDeckSdkVersion}`);
}

async function readJson(filePath) {
	return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
	await writeFile(filePath, `${JSON.stringify(value, null, 4)}\n`);
}

async function pathExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

export function relativePath(from, to) {
	return path.relative(from, to) || ".";
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
