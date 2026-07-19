import { execFileSync } from "node:child_process";
import { chmod, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(packageRoot, ".native");
const universal = process.argv.includes("--universal");

if (process.platform === "darwin") {
	const architectures = universal ? ["arm64", "x86_64"] : [process.arch === "arm64" ? "arm64" : "x86_64"];
	const bridgeOutputs = [];
	await rm(path.join(outputRoot, "macos"), { recursive: true, force: true });

	for (const architecture of architectures) {
		const scratchPath = path.join(outputRoot, `swift-${architecture}`);
		await rm(scratchPath, { recursive: true, force: true });
		const commonArgs = [
			"--package-path",
			path.join(packageRoot, "native/macos"),
			"--scratch-path",
			scratchPath,
			"--configuration",
			"release",
			"--arch",
			architecture,
		];
		execFileSync("swift", ["build", ...commonArgs, "-Xswiftc", "-warnings-as-errors"], {
			stdio: "inherit",
		});
		const binPath = execFileSync("swift", ["build", ...commonArgs, "--show-bin-path"], {
			encoding: "utf8",
		}).trim();
		bridgeOutputs.push(path.join(binPath, "audio-bridge"));
	}

	const destination = path.join(outputRoot, "macos/audio-bridge");
	await mkdir(path.dirname(destination), { recursive: true });
	if (universal) {
		execFileSync("lipo", ["-create", ...bridgeOutputs, "-output", destination], { stdio: "inherit" });
	} else {
		await copyFile(bridgeOutputs[0], destination);
	}
	await chmod(destination, 0o755);
} else if (process.platform === "win32") {
	const windowsRoot = path.join(outputRoot, "windows");
	const buildRoot = path.join(windowsRoot, "build");
	await rm(windowsRoot, { recursive: true, force: true });
	await mkdir(buildRoot, { recursive: true });
	execFileSync(
		"dotnet",
		[
			"build",
			path.join(packageRoot, "native/windows/AudioBridge.csproj"),
			"-c",
			"Release",
			"-p:Platform=x64",
			"-o",
			buildRoot,
		],
		{ stdio: "inherit" },
	);
	await copyFile(path.join(buildRoot, "audio-bridge.exe"), path.join(windowsRoot, "audio-bridge.exe"));
} else {
	throw new Error(`Unsupported native build platform: ${process.platform}`);
}
