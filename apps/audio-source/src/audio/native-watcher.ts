import type { ChildProcess } from "node:child_process";

import { streamDeck } from "@elgato/streamdeck";

const MAX_STDERR_LENGTH = 4_096;
const STARTUP_TIMEOUT_MS = 10_000;

/**
 * Waits for a native watch bridge to become ready and returns an idempotent
 * cleanup callback while continuing to dispatch change notifications.
 */
export function bindNativeWatcher(
	watcher: ChildProcess,
	bridgeName: string,
	listener: () => void,
	killSignal?: NodeJS.Signals,
): Promise<() => void> {
	return new Promise((resolve, reject) => {
		let ready = false;
		let stopped = false;
		let stdoutBuffer = "";
		let stderrBuffer = "";

		const startupTimeout = setTimeout(() => {
			if (ready || stopped) return;
			stopped = true;
			detachListeners();
			if (!watcher.killed) terminateWatcher(watcher, killSignal);
			reject(startupError(`${bridgeName} watcher timed out before ready.`, stderrBuffer));
		}, STARTUP_TIMEOUT_MS);

		const cleanup = () => {
			if (stopped) {
				detachListeners();
				return;
			}
			stopped = true;
			clearTimeout(startupTimeout);
			detachListeners();
			if (!watcher.killed) terminateWatcher(watcher, killSignal);
		};

		const failStartup = (message: string) => {
			if (ready || stopped) return;
			stopped = true;
			clearTimeout(startupTimeout);
			detachListeners();
			reject(startupError(message, stderrBuffer));
		};

		const detachListeners = () => {
			watcher.stdout?.off("data", onStdout);
			watcher.stderr?.off("data", onStderr);
			watcher.off("error", onError);
			watcher.off("exit", onExit);
		};

		function onStdout(chunk: Buffer | string) {
			stdoutBuffer += chunk.toString();

			let newlineIndex = stdoutBuffer.indexOf("\n");
			while (newlineIndex >= 0) {
				const line = stdoutBuffer.slice(0, newlineIndex).trim();
				stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

				if (line === "ready" && !ready && !stopped) {
					ready = true;
					clearTimeout(startupTimeout);
					resolve(cleanup);
				} else if (line === "changed" && ready && !stopped) {
					listener();
				}

				newlineIndex = stdoutBuffer.indexOf("\n");
			}
		}

		function onStderr(chunk: Buffer | string) {
			stderrBuffer = (stderrBuffer + chunk.toString()).slice(-MAX_STDERR_LENGTH);
		}

		function onError(error: Error) {
			if (!ready) {
				failStartup(`${bridgeName} watcher failed to start: ${error.message}`);
				return;
			}

			if (!stopped) {
				stopped = true;
				clearTimeout(startupTimeout);
				detachListeners();
				streamDeck.logger.error(`${bridgeName} watcher failed unexpectedly: ${error.message}`);
			}
		}

		function onExit(code: number | null, signal: NodeJS.Signals | null) {
			const status = code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`;
			if (!ready) {
				failStartup(`${bridgeName} watcher exited before ready with ${status}.`);
				return;
			}

			if (!stopped) {
				stopped = true;
				clearTimeout(startupTimeout);
				detachListeners();
				streamDeck.logger.error(`${bridgeName} watcher exited unexpectedly with ${status}.`);
			}
		}

		watcher.stdout?.on("data", onStdout);
		watcher.stderr?.on("data", onStderr);
		watcher.on("error", onError);
		watcher.on("exit", onExit);

		if (!watcher.stdout) {
			failStartup(`${bridgeName} watcher did not expose stdout.`);
		}
	});
}

function startupError(message: string, stderr: string): Error {
	const detail = stderr.trim();
	return new Error(detail ? `${message}\n${detail}` : message);
}

function terminateWatcher(watcher: ChildProcess, signal?: NodeJS.Signals): void {
	if (signal) watcher.kill(signal);
	else watcher.kill();
}
