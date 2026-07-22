import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
	throw new Error(`Windows native integration test requires win32, received ${process.platform}.`);
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executable = path.join(packageRoot, ".native/windows/audio-bridge.exe");
const maxBuffer = 2 * 1024 * 1024;

const queryOutput = execFileSync(executable, ["query", "output"], {
	encoding: "utf8",
	maxBuffer,
	timeout: 15_000,
	windowsHide: true,
});
const queryLine = queryOutput
	.split(/\r?\n/u)
	.map((entry) => entry.trim())
	.filter(Boolean)
	.at(-1);
const queryResponse = JSON.parse(queryLine ?? "null");
if (
	!Array.isArray(queryResponse?.devices) ||
	!(queryResponse.defaultId === null || typeof queryResponse.defaultId === "string")
) {
	throw new Error(`Unexpected Windows query response: ${queryLine ?? "<empty>"}`);
}

await waitForWatcherReady(executable);
console.log("Windows native query and watcher smoke tests passed.");

function waitForWatcherReady(bridgeExecutable) {
	return new Promise((resolve, reject) => {
		const watcher = spawn(bridgeExecutable, ["watch", "output"], {
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let stdoutBuffer = "";
		let stderrBuffer = "";
		let settled = false;

		const timer = setTimeout(() => {
			finish(new Error(withStderr("Windows watcher timed out before ready.", stderrBuffer)));
		}, 10_000);

		watcher.stdout.on("data", (chunk) => {
			stdoutBuffer += chunk.toString("utf8");
			let newlineIndex = stdoutBuffer.indexOf("\n");
			while (newlineIndex >= 0) {
				const line = stdoutBuffer.slice(0, newlineIndex).trim();
				stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
				if (line === "ready") {
					finish();
					return;
				}
				newlineIndex = stdoutBuffer.indexOf("\n");
			}
		});
		watcher.stderr.on("data", (chunk) => {
			stderrBuffer = (stderrBuffer + chunk.toString("utf8")).slice(-4_096);
		});
		watcher.once("error", (error) => {
			finish(new Error(withStderr(`Windows watcher failed to start: ${error.message}`, stderrBuffer)));
		});
		watcher.once("exit", (code, signal) => {
			const status = code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`;
			finish(new Error(withStderr(`Windows watcher exited before ready with ${status}.`, stderrBuffer)));
		});

		function finish(error) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (!watcher.killed) watcher.kill();
			if (error) reject(error);
			else resolve();
		}
	});
}

function withStderr(message, stderr) {
	const detail = stderr.trim();
	return detail ? `${message}\n${detail}` : message;
}
