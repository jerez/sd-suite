import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { LocalUsbngDevice, RemoteUsbngDevice } from "../device-types";

import { parseLocalUsbngDevices, parseNetworkUsbngDevices } from "../cli-parser";
import { UsbngNotAvailableError, type UsbngPlatformAdapter } from "../platform-adapter";

const execFileAsync = promisify(execFile);

export const DEFAULT_EVEUSBC_PATH = "/Library/Frameworks/EveUSB.framework/Support/eveusbc";

export type RunCommand = (file: string, args: string[]) => Promise<string>;
export type RunAppleScript = (script: string) => Promise<void>;

export type CreateMacosUsbngAdapterOptions = {
	eveusbcPath?: string;
	runAppleScript?: RunAppleScript;
	runCommand?: RunCommand;
};

export function createMacosUsbngAdapter(options: CreateMacosUsbngAdapterOptions = {}): UsbngPlatformAdapter {
	const eveusbcPath = options.eveusbcPath ?? DEFAULT_EVEUSBC_PATH;
	const runCommand = options.runCommand ?? defaultRunCommand;
	const runAppleScript = options.runAppleScript ?? defaultRunAppleScript;

	return {
		async connectDevice(device: RemoteUsbngDevice): Promise<void> {
			await runAppleScript(buildRemoteDeviceScript("connect", device.name));
		},
		async disconnectDevice(device: RemoteUsbngDevice): Promise<void> {
			await runAppleScript(buildRemoteDeviceScript("disconnect", device.name));
		},
		async listLocalDevices(): Promise<LocalUsbngDevice[]> {
			return parseLocalUsbngDevices(await runCommand(eveusbcPath, ["ls", "local"]));
		},
		async listRemoteDevices(): Promise<RemoteUsbngDevice[]> {
			return parseNetworkUsbngDevices(await runCommand(eveusbcPath, ["ls", "net"]));
		},
		async shareDevice(device: LocalUsbngDevice): Promise<void> {
			await runAppleScript(buildLocalDeviceScript("share", device.name));
		},
		async unshareDevice(device: LocalUsbngDevice): Promise<void> {
			await runAppleScript(buildLocalDeviceScript("unshare", device.name));
		},
	};
}

async function defaultRunCommand(file: string, args: string[]): Promise<string> {
	try {
		const { stdout } = await execFileAsync(file, args, { encoding: "utf8" });
		return stdout;
	} catch (error) {
		throw mapProcessError(error);
	}
}

async function defaultRunAppleScript(script: string): Promise<void> {
	try {
		await execFileAsync("osascript", ["-e", script], { encoding: "utf8" });
	} catch (error) {
		throw mapProcessError(error);
	}
}

function buildLocalDeviceScript(operation: "share" | "unshare", deviceName: string): string {
	const escapedDeviceName = escapeAppleScriptString(deviceName);

	return [
		'tell application "USB Network Gate"',
		`${operation} (first device whose name is "${escapedDeviceName}")`,
		"end tell",
	].join("\n");
}

function buildRemoteDeviceScript(operation: "connect" | "disconnect", deviceName: string): string {
	const escapedDeviceName = escapeAppleScriptString(deviceName);
	const command = operation === "connect" ? "connect to" : "disconnect from";

	return [
		'tell application "USB Network Gate"',
		`${command} (first remote device whose name is "${escapedDeviceName}")`,
		"end tell",
	].join("\n");
}

function escapeAppleScriptString(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function mapProcessError(error: unknown): Error {
	if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
		return new UsbngNotAvailableError();
	}

	return error instanceof Error ? error : new Error(String(error));
}
