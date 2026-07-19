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

vi.mock("node:child_process", () => ({
	execFile: childProcessMocks.execFile,
	spawn: childProcessMocks.spawn,
}));

import { audioInputApi, audioOutputApi } from "./mac";

const originalCwd = process.cwd();
let root = "";
let executable = "";

function createWatcher() {
	return {
		killed: false,
		kill: vi.fn(),
		stderr: new EventEmitter(),
		stdout: new EventEmitter(),
	};
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

	it("buffers watcher lines across chunks and terminates the compiled bridge", async () => {
		const watcher = createWatcher();
		childProcessMocks.spawn.mockReturnValue(watcher);
		const listener = vi.fn();

		const cleanup = await audioOutputApi.subscribeDefaultDeviceChanges(listener);
		expect(childProcessMocks.spawn).toHaveBeenCalledWith(executable, ["watch", "output"], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		watcher.stdout.emit("data", Buffer.from("chan"));
		watcher.stdout.emit("data", Buffer.from("ged\nignored\nchanged"));
		expect(listener).toHaveBeenCalledTimes(1);
		watcher.stdout.emit("data", Buffer.from("\n"));
		expect(listener).toHaveBeenCalledTimes(2);

		cleanup();
		expect(watcher.kill).toHaveBeenCalledWith("SIGTERM");
		watcher.killed = true;
		cleanup();
		expect(watcher.kill).toHaveBeenCalledOnce();
	});
});
