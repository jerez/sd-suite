import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => {
	const state = { stdout: "" };
	const execFile = vi.fn();
	Object.defineProperty(execFile, Symbol.for("nodejs.util.promisify.custom"), {
		value: (executable: string, args: string[], options: object) => {
			execFile(executable, args, options);
			return Promise.resolve({ stdout: state.stdout, stderr: "" });
		},
	});
	return { execFile, spawn: vi.fn(), state };
});

const loggerMocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("node:child_process", () => ({
	execFile: childProcessMocks.execFile,
	spawn: childProcessMocks.spawn,
}));

vi.mock("@elgato/streamdeck", () => ({
	streamDeck: { logger: loggerMocks },
}));

import { audioInputApi, audioOutputApi } from "./mac";

const originalCwd = process.cwd();
let root = "";
let executable = "";

function createWatcher() {
	return Object.assign(new EventEmitter(), {
		killed: false,
		kill: vi.fn(),
		stderr: new EventEmitter(),
		stdout: new EventEmitter(),
	});
}

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), "audio-source-mac-adapter-"));
	process.chdir(root);
	root = process.cwd();
	executable = path.join(root, "dev.jerez.sds.audio-source.sdPlugin/native/macos/audio-bridge");
	mkdirSync(path.dirname(executable), { recursive: true });
	writeFileSync(executable, "");
	childProcessMocks.execFile.mockClear();
	childProcessMocks.spawn.mockReset();
	loggerMocks.error.mockReset();
	childProcessMocks.state.stdout = JSON.stringify({ devices: [], defaultId: null });
});

afterEach(() => {
	process.chdir(originalCwd);
	rmSync(root, { recursive: true, force: true });
});

describe("macOS native bridge invocation", () => {
	it("queries through the compiled bridge with bounded execution options", async () => {
		await expect(audioOutputApi.getAudioDevices()).resolves.toEqual([]);

		expect(childProcessMocks.execFile).toHaveBeenCalledWith(executable, ["query", "output"], {
			timeout: 15_000,
			maxBuffer: 2 * 1024 * 1024,
			windowsHide: process.platform === "win32",
		});
	});

	it("passes the input scope and device ID positionally when setting", async () => {
		await expect(audioInputApi.setDefaultDevice("input-device")).resolves.toBeUndefined();

		expect(childProcessMocks.execFile).toHaveBeenCalledWith(executable, ["set", "input", "input-device"], {
			timeout: 15_000,
			maxBuffer: 2 * 1024 * 1024,
			windowsHide: process.platform === "win32",
		});
	});

	it("waits for ready, buffers changed lines across chunks, and cleans up once", async () => {
		const watcher = createWatcher();
		childProcessMocks.spawn.mockReturnValue(watcher);
		const listener = vi.fn();

		const subscription = audioOutputApi.subscribeDefaultDeviceChanges(listener);
		expect(childProcessMocks.spawn).toHaveBeenCalledWith(executable, ["watch", "output"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let settled = false;
		subscription.finally(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		watcher.stdout.emit("data", Buffer.from("rea"));
		watcher.stdout.emit("data", Buffer.from("dy\nchan"));
		const cleanup = await subscription;

		watcher.stdout.emit("data", Buffer.from("ged\nignored\nchanged"));
		expect(listener).toHaveBeenCalledTimes(1);
		watcher.stdout.emit("data", Buffer.from("\n"));
		expect(listener).toHaveBeenCalledTimes(2);

		cleanup();
		expect(watcher.kill).toHaveBeenCalledWith("SIGTERM");
		expect(watcher.stdout.listenerCount("data")).toBe(0);
		expect(watcher.stderr.listenerCount("data")).toBe(0);
		expect(watcher.listenerCount("error")).toBe(0);
		expect(watcher.listenerCount("exit")).toBe(0);
		expect(loggerMocks.error).not.toHaveBeenCalled();
		watcher.killed = true;
		cleanup();
		expect(watcher.kill).toHaveBeenCalledOnce();
	});

	it("rejects watcher startup errors with bounded stderr context", async () => {
		const watcher = createWatcher();
		childProcessMocks.spawn.mockReturnValue(watcher);

		const subscription = audioOutputApi.subscribeDefaultDeviceChanges(vi.fn());
		watcher.stderr.emit("data", Buffer.from("x".repeat(10_000)));
		watcher.emit("error", new Error("ENOENT"));

		await expect(subscription).rejects.toThrow(/ENOENT.*x{1,4096}$/su);
	});

	it("rejects an early exit and logs an unexpected exit after ready", async () => {
		const earlyWatcher = createWatcher();
		childProcessMocks.spawn.mockReturnValueOnce(earlyWatcher);
		const earlySubscription = audioOutputApi.subscribeDefaultDeviceChanges(vi.fn());
		earlyWatcher.stderr.emit("data", Buffer.from("startup failed"));
		earlyWatcher.emit("exit", 2, null);
		await expect(earlySubscription).rejects.toThrow(/exited before ready.*startup failed/su);

		const readyWatcher = createWatcher();
		childProcessMocks.spawn.mockReturnValueOnce(readyWatcher);
		const readySubscription = audioOutputApi.subscribeDefaultDeviceChanges(vi.fn());
		readyWatcher.stdout.emit("data", Buffer.from("ready\n"));
		await readySubscription;
		readyWatcher.emit("exit", 3, null);
		expect(loggerMocks.error).toHaveBeenCalledWith(expect.stringContaining("exited unexpectedly"));
	});
});
