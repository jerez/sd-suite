import { access, chmod, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const PLUGIN_DIRECTORY = "dev.jerez.sds.audio-source.sdPlugin";
export const RELEASE_ARTIFACTS = [
	{
		source: ".native/macos/audio-bridge",
		destination: "native/macos/audio-bridge",
		executable: true,
	},
	{
		source: ".native/windows/audio-bridge.exe",
		destination: "native/windows/audio-bridge.exe",
		executable: false,
	},
];

function stagedNativeRoot(root) {
	return path.join(root, PLUGIN_DIRECTORY, "native");
}

export async function clearStagedNative(root = process.cwd()) {
	await rm(stagedNativeRoot(root), { recursive: true, force: true });
}

export async function stageReleaseArtifacts(root = process.cwd()) {
	await clearStagedNative(root);
	for (const artifact of RELEASE_ARTIFACTS) {
		const source = path.join(root, artifact.source);
		const destination = path.join(root, PLUGIN_DIRECTORY, artifact.destination);
		await access(source);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(source, destination);
		if (artifact.executable) await chmod(destination, 0o755);
	}
}

export async function stageDevelopmentBridge(root = process.cwd(), platform = process.platform) {
	await clearStagedNative(root);
	const nativeRoot = stagedNativeRoot(root);
	await mkdir(nativeRoot, { recursive: true });

	if (platform === "darwin") {
		const source = path.join(root, "native/macos/Sources/AudioBridge/main.swift");
		const destination = path.join(nativeRoot, "macos/main.swift");
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(source, destination);
	} else if (platform === "win32") {
		const destination = path.join(nativeRoot, "windows");
		await mkdir(destination, { recursive: true });
		await copyFile(path.join(root, "native/windows/Program.cs"), path.join(destination, "Program.cs"));
		await copyFile(path.join(root, "native/windows/audio-bridge.ps1"), path.join(destination, "audio-bridge.ps1"));
	} else {
		throw new Error(`Unsupported native development platform: ${platform}`);
	}

	await writeFile(path.join(nativeRoot, ".development-mode"), `${platform}\n`);
}

async function collectFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
		}),
	);
	return nested.flat();
}

export async function validateStagedRelease(root = process.cwd()) {
	for (const artifact of RELEASE_ARTIFACTS) {
		await access(path.join(root, PLUGIN_DIRECTORY, artifact.destination));
	}

	const nativeRoot = stagedNativeRoot(root);
	const files = await collectFiles(nativeRoot);
	const forbidden = files.filter((file) => {
		const relative = path.relative(nativeRoot, file).split(path.sep).join("/");
		return (
			relative === ".development-mode" || [".swift", ".cs", ".ps1", ".csproj", ".pdb"].includes(path.extname(file))
		);
	});

	if (forbidden.length > 0) {
		throw new Error(`Forbidden native package files: ${forbidden.join(", ")}`);
	}

	const marker = path.join(nativeRoot, ".development-mode");
	try {
		await readFile(marker, "utf8");
		throw new Error(`Forbidden native package file: ${marker}`);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}
