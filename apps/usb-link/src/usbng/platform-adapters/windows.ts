import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { LocalUsbngDevice, RemoteUsbngDevice, RemoteUsbngDeviceState } from "../device-types";
import { UsbngNotAvailableError, type UsbngPlatformAdapter } from "../platform-adapter";

const execFileAsync = promisify(execFile);
const USB_NETWORK_GATE_FOLDER = ["Electronic Team", "USB Network Gate"];
const WINDOWS_64_BINARY = "UsbService64.exe";
const WINDOWS_32_BINARY = "UsbService.exe";

/**
 * Executes a local command and returns its combined textual output.
 */
export type RunCommand = (file: string, args: string[]) => Promise<string>;

/**
 * Dependency injection points for the Windows adapter.
 */
export type CreateWindowsUsbngAdapterOptions = {
	env?: NodeJS.ProcessEnv;
	runCommand?: RunCommand;
	usbServicePaths?: string[];
};

type ParsedWindowsRemoteDevice = {
	id: string;
	name: string;
	server: string;
	state: RemoteUsbngDeviceState;
};

/**
 * Creates the Windows USBNG adapter backed by the installed client CLI.
 */
export function createWindowsUsbngAdapter(options: CreateWindowsUsbngAdapterOptions = {}): UsbngPlatformAdapter {
	const runCommand = options.runCommand ?? defaultRunCommand;
	const usbServicePaths = options.usbServicePaths ?? getDefaultUsbServicePaths(options.env ?? process.env);

	return {
		async connectDevice(device: RemoteUsbngDevice): Promise<void> {
			await runUsbServiceCommand(runCommand, usbServicePaths, ["connect-remote-device", device.id]);
		},
		async disconnectDevice(device: RemoteUsbngDevice): Promise<void> {
			await runUsbServiceCommand(runCommand, usbServicePaths, ["disconnect-remote-device", device.id]);
		},
		async listLocalDevices(): Promise<LocalUsbngDevice[]> {
			const output = await runUsbServiceCommand(runCommand, usbServicePaths, ["show-usb-list"]);
			return parseWindowsLocalDevices(output);
		},
		async listRemoteDevices(): Promise<RemoteUsbngDevice[]> {
			const addedDevices = parseWindowsRemoteDevices(
				await runUsbServiceCommand(runCommand, usbServicePaths, ["show-remote-devices"]),
			);
			if (addedDevices.length === 0) {
				return [];
			}

			const discoveredDevices = await discoverKnownRemoteDevices(runCommand, usbServicePaths, addedDevices);
			const discoveredDevicesById = new Map(discoveredDevices.map((device) => [device.id, device]));

			return addedDevices.map((device) => {
				const discoveredDevice = discoveredDevicesById.get(device.id);
				if (!discoveredDevice) {
					return {
						id: device.id,
						name: device.name,
						state: device.state,
					};
				}

				return {
					id: discoveredDevice.id,
					name: discoveredDevice.name,
					state: discoveredDevice.state,
				};
			});
		},
		async shareDevice(device: LocalUsbngDevice): Promise<void> {
			await runUsbServiceCommand(runCommand, usbServicePaths, ["share-usb-port", device.id]);
		},
		async unshareDevice(device: LocalUsbngDevice): Promise<void> {
			await runUsbServiceCommand(runCommand, usbServicePaths, ["unshare-usb-port", device.id]);
		},
	};
}

function getDefaultUsbServicePaths(env: NodeJS.ProcessEnv): string[] {
	const roots = [env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"]].filter((value): value is string =>
		Boolean(value),
	);
	const candidates = roots.flatMap((root) => [
		path.win32.join(root, ...USB_NETWORK_GATE_FOLDER, WINDOWS_64_BINARY),
		path.win32.join(root, ...USB_NETWORK_GATE_FOLDER, WINDOWS_32_BINARY),
	]);

	return [...new Set(candidates)];
}

async function runUsbServiceCommand(
	runCommand: RunCommand,
	usbServicePaths: string[],
	args: string[],
): Promise<string> {
	let lastError: Error | undefined;

	for (const usbServicePath of usbServicePaths) {
		try {
			const output = await runCommand(usbServicePath, args);
			throwIfUsbServiceOutputHasError(output);
			return output;
		} catch (error) {
			if (error instanceof UsbngNotAvailableError) {
				lastError = error;
				continue;
			}

			throw error;
		}
	}

	throw lastError ?? new UsbngNotAvailableError();
}

async function discoverKnownRemoteDevices(
	runCommand: RunCommand,
	usbServicePaths: string[],
	addedDevices: ParsedWindowsRemoteDevice[],
): Promise<ParsedWindowsRemoteDevice[]> {
	const devicesByServer = new Map<string, ParsedWindowsRemoteDevice[]>();
	for (const device of addedDevices) {
		// Discover once per server even when multiple added devices point at the same host.
		const serverDevices = devicesByServer.get(device.server) ?? [];
		serverDevices.push(device);
		devicesByServer.set(device.server, serverDevices);
	}

	const discoveredDevices: ParsedWindowsRemoteDevice[] = [];
	for (const server of devicesByServer.keys()) {
		try {
			const output = await runUsbServiceCommand(runCommand, usbServicePaths, ["find-remote-devices", server]);
			discoveredDevices.push(...parseWindowsRemoteDevices(output));
		} catch {
			// Keep the existing added-device view when discovery on one server fails.
		}
	}

	return discoveredDevices;
}

function parseWindowsLocalDevices(output: string): LocalUsbngDevice[] {
	return splitUsbServiceOutput(output).flatMap((line) => {
		const match = line.match(/^\s*(.+?)\t-\s*([0-9:]+)$/u);
		if (!match) {
			return [];
		}

		const [, rawName, rawId] = match;
		if (!rawName || !rawId) {
			return [];
		}

		const name = rawName.trim();
		if (name.endsWith(": Free")) {
			return [];
		}

		return [
			{
				id: rawId.trim(),
				name,
			},
		];
	});
}

function parseWindowsRemoteDevices(output: string): ParsedWindowsRemoteDevice[] {
	return splitUsbServiceOutput(output).flatMap((line) => {
		const parts = line.split("\t-").map((part) => part.trim());
		if (parts.length < 2) {
			return [];
		}

		const [rawName, rawId, ...details] = parts;
		if (!rawName || !rawId) {
			return [];
		}

		const status = details.at(-1) ?? "";
		const state = status.startsWith("connected") ? "connected" : "remote";
		const server = extractServerFromRemoteId(rawId);

		return [
			{
				id: rawId,
				name: rawName,
				server,
				state,
			},
		];
	});
}

function extractServerFromRemoteId(remoteId: string): string {
	const separatorIndex = remoteId.lastIndexOf(":");
	if (separatorIndex === -1) {
		return remoteId;
	}

	return remoteId.slice(0, separatorIndex);
}

function splitUsbServiceOutput(output: string): string[] {
	return output
		.split(/\r?\n/u)
		.map((line) => line.trimEnd())
		.filter((line) => line.trim().length > 0 && line.trim() !== "USB Network Gate");
}

function throwIfUsbServiceOutputHasError(output: string): void {
	// The Windows client can return output even when the process exit code is not reliable.
	const match = output.match(/^\s*Error:\s*(.+)$/mu);
	if (match?.[1]) {
		throw new Error(match[1].trim());
	}
}

async function defaultRunCommand(file: string, args: string[]): Promise<string> {
	try {
		const result = await execFileAsync(file, args, {
			encoding: "utf8",
			windowsHide: true,
		});
		return `${result.stdout}${result.stderr}`;
	} catch (error) {
		if (isNotFoundError(error)) {
			throw new UsbngNotAvailableError();
		}

		if (hasCommandOutput(error)) {
			// Preserve command output so callers can still parse valid listings before checking for `Error:`.
			return `${error.stdout}${error.stderr}`;
		}

		throw error instanceof Error ? error : new Error(String(error));
	}
}

function isNotFoundError(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function hasCommandOutput(error: unknown): error is { stderr: string; stdout: string } {
	return typeof error === "object" && error !== null && "stdout" in error && "stderr" in error;
}
