import { spawn } from "node:child_process";

import type { LocalUsbngDevice, RemoteUsbngDevice } from "../device-types";

import { parseLocalUsbngDevices, parseNetworkUsbngDevices, parseSharedUsbngDevices } from "../cli-parser";
import { UsbngNotAvailableError, type UsbngPlatformAdapter } from "../platform-adapter";

/**
 * Default path to the USBNG CLI helper installed by the macOS client.
 */
export const DEFAULT_EVEUSBC_PATH = "/Library/Frameworks/EveUSB.framework/Support/eveusbc";

/**
 * Executes a local command and returns its stdout payload.
 */
export type RunCommand = (file: string, args: string[]) => Promise<string>;
/**
 * Dependency injection points for the macOS adapter.
 */
export type CreateMacosUsbngAdapterOptions = {
	eveusbcPath?: string;
	runCommand?: RunCommand;
};

/**
 * Creates the macOS USBNG adapter.
 *
 * Enumeration and most control operations use the installed `eveusbc` CLI.
 */
export function createMacosUsbngAdapter(options: CreateMacosUsbngAdapterOptions = {}): UsbngPlatformAdapter {
	const eveusbcPath = options.eveusbcPath ?? DEFAULT_EVEUSBC_PATH;
	const runCommand = options.runCommand ?? runCommandWithClosedStdin;

	return {
		async connectDevice(device: RemoteUsbngDevice): Promise<void> {
			await runCommand(eveusbcPath, ["connect", device.id]);
		},
		async disconnectDevice(device: RemoteUsbngDevice): Promise<void> {
			await runCommand(eveusbcPath, ["disconnect", device.id]);
		},
		async listLocalDevices(): Promise<LocalUsbngDevice[]> {
			return parseLocalUsbngDevices(await runCommand(eveusbcPath, ["ls", "local"]));
		},
		async listRemoteDevices(server?: string): Promise<RemoteUsbngDevice[]> {
			const host = server?.trim();
			if (host) {
				await runCommand(eveusbcPath, ["explore", host]);
			}
			return parseNetworkUsbngDevices(await runCommand(eveusbcPath, ["ls", "net"]));
		},
		async listSharedDevices(): Promise<LocalUsbngDevice[]> {
			return parseSharedUsbngDevices(await runCommand(eveusbcPath, ["ls", "shared"]));
		},
		async shareDevice(device: LocalUsbngDevice): Promise<void> {
			await runCommand("osascript", ["-e", buildShareScript(device.id)]);
		},
		async unshareDevice(device: LocalUsbngDevice): Promise<void> {
			await runCommand(eveusbcPath, ["unshare", device.id]);
		},
	};
}

function buildShareScript(deviceId: string): string {
	return [
		'tell application "USB Network Gate"',
		`share (first device whose id is ${toLocationId(deviceId)})`,
		"end tell",
		"delay 3",
	].join("\n");
}

function toLocationId(deviceId: string): number {
	const [busText, pathText, ...extra] = deviceId.split("-");
	const bus = Number(busText);
	const ports = pathText?.split(".").map(Number) ?? [];

	if (
		extra.length > 0 ||
		!Number.isInteger(bus) ||
		bus < 0 ||
		bus > 255 ||
		ports.length === 0 ||
		ports.length > 6 ||
		ports.some((port) => !Number.isInteger(port) || port < 0 || port > 15)
	) {
		throw new Error(`USB Network Gate returned an invalid local device ID: "${deviceId}".`);
	}

	return bus * 0x1000000 + ports.reduce((location, port, index) => location + port * 16 ** (5 - index), 0);
}

export function runCommandWithClosedStdin(file: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => (stdout += chunk));
		child.stderr.on("data", (chunk: string) => (stderr += chunk));
		child.once("error", (error) => reject(mapProcessError(error)));
		child.once("close", (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(stderr.trim() || `eveusbc exited with code ${code}.`));
			}
		});
	});
}

function mapProcessError(error: unknown): Error {
	if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
		return new UsbngNotAvailableError();
	}

	return error instanceof Error ? error : new Error(String(error));
}
