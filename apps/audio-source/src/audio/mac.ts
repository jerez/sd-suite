import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { AudioDeviceApi } from "./contracts";
import { type NativeCommand, nativePluginRoots, resolveNativeCommand } from "./native-command";
import { bindNativeWatcher } from "./native-watcher";
import type { AudioDevice } from "./types";

type AudioScope = "output" | "input";
type BridgeAction = "query" | "set";

const execFileAsync = promisify(execFile);

function createMacAudioDeviceApi(scope: AudioScope): AudioDeviceApi {
	return {
		getAudioDevices: async () => {
			const response = await runSwiftBridge(scope, "query");
			return response.devices;
		},
		getDefaultDevice: async () => {
			const response = await runSwiftBridge(scope, "query");
			if (!response.defaultId) {
				return null;
			}

			return response.devices.find((device) => device.id === response.defaultId) ?? null;
		},
		setDefaultDevice: async (deviceId: string) => {
			await runSwiftBridge(scope, "set", deviceId);
		},
		subscribeDefaultDeviceChanges: async (listener: () => void) => {
			const nativeCommand = getNativeCommand();
			const watcher = spawn(nativeCommand.executable, [...nativeCommand.prefixArgs, "watch", scope], {
				stdio: ["ignore", "pipe", "pipe"],
			});

			return bindNativeWatcher(watcher, "CoreAudio", listener, "SIGTERM");
		},
	};
}

/**
 * Executes the compiled CoreAudio bridge and parses its JSON response.
 */
async function runSwiftBridge(scope: AudioScope, action: BridgeAction, deviceId?: string): Promise<BridgeResponse> {
	const nativeCommand = getNativeCommand();
	const args = [...nativeCommand.prefixArgs, action, scope];
	if (deviceId) {
		args.push(deviceId);
	}

	const { stdout } = await execFileAsync(nativeCommand.executable, args, {
		timeout: 15_000,
		maxBuffer: 2 * 1024 * 1024,
		windowsHide: process.platform === "win32",
	});

	const text = stdout.trim();
	if (!text) {
		throw new Error("CoreAudio bridge returned an empty response.");
	}

	return parseBridgeResponse(text);
}

function getNativeCommand(): NativeCommand {
	return resolveNativeCommand("darwin", nativePluginRoots(import.meta.url));
}

/**
 * Parses the bridge JSON payload from stdout.
 */
function parseBridgeResponse(stdout: string): BridgeResponse {
	const line = stdout
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.at(-1);

	if (!line) {
		throw new Error("CoreAudio bridge response is missing JSON output.");
	}

	const parsed = JSON.parse(line) as Partial<BridgeResponse>;
	const devices = Array.isArray(parsed.devices) ? parsed.devices : [];

	return {
		devices: devices
			.filter((item): item is AudioDevice => typeof item?.id === "string" && typeof item?.name === "string")
			.map((item) => ({
				id: item.id,
				name: item.name,
				formFactor: item.formFactor,
				transportType: item.transportType,
				isDisabled: typeof item.isDisabled === "boolean" ? item.isDisabled : undefined,
				isMuted: typeof item.isMuted === "boolean" ? item.isMuted : undefined,
			})),
		defaultId: typeof parsed.defaultId === "string" ? parsed.defaultId : null,
	};
}

/**
 * Raw bridge response shape emitted by the CoreAudio bridge.
 */
interface BridgeResponse {
	devices: AudioDevice[];
	defaultId: string | null;
}

/**
 * macOS implementation of the shared audio-device contracts.
 */
export const audioOutputApi: AudioDeviceApi = createMacAudioDeviceApi("output");
export const audioInputApi: AudioDeviceApi = createMacAudioDeviceApi("input");
