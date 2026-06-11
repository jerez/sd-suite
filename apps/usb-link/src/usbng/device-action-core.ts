import type { DeviceActionSettings, DeviceOperation, RemoteUsbngDevice } from "./device-types";

import { parseDeviceActionSettings } from "./device-action-settings";
import { matchDeviceByName } from "./device-match";
import { UsbngNotAvailableError, type UsbngPlatformAdapter } from "./platform-adapter";

/**
 * Inputs required by the shared USBNG action core.
 */
export type ExecuteDeviceActionInput = {
	adapter: UsbngPlatformAdapter;
	operation: DeviceOperation;
	settings: DeviceActionSettings;
};

/**
 * Result returned by the shared USBNG action core.
 */
export type DeviceActionExecutionResult = { ok: true } | { detail?: string; error: string; ok: false };

/**
 * Validates action settings, resolves the requested device, and dispatches the
 * operation to the platform-specific adapter.
 */
export async function executeDeviceAction(input: ExecuteDeviceActionInput): Promise<DeviceActionExecutionResult> {
	const parsedSettings = parseDeviceActionSettings(input.settings);
	if (!parsedSettings.ok) {
		return parsedSettings;
	}

	try {
		if (input.operation === "share" || input.operation === "unshare") {
			return await executeLocalDeviceAction(input.operation, parsedSettings.value.deviceName, input.adapter);
		}

		return await executeRemoteDeviceAction(input.operation, parsedSettings.value.deviceName, input.adapter);
	} catch (error) {
		return mapAdapterError(input.operation, parsedSettings.value.deviceName, error);
	}
}

async function executeLocalDeviceAction(
	operation: "share" | "unshare",
	deviceName: string,
	adapter: UsbngPlatformAdapter,
): Promise<DeviceActionExecutionResult> {
	const devices = await adapter.listLocalDevices();
	const matchedDevice = matchDeviceByName(devices, deviceName);
	if (!matchedDevice.ok) {
		return matchedDevice;
	}

	if (operation === "share") {
		await adapter.shareDevice(matchedDevice.value);
	} else {
		await adapter.unshareDevice(matchedDevice.value);
	}

	return { ok: true };
}

async function executeRemoteDeviceAction(
	operation: "connect" | "disconnect",
	deviceName: string,
	adapter: UsbngPlatformAdapter,
): Promise<DeviceActionExecutionResult> {
	const devices = filterRemoteDevicesForOperation(await adapter.listRemoteDevices(), operation);
	const matchedDevice = matchDeviceByName(devices, deviceName);
	if (!matchedDevice.ok) {
		return matchedDevice;
	}

	if (operation === "connect") {
		await adapter.connectDevice(matchedDevice.value);
	} else {
		await adapter.disconnectDevice(matchedDevice.value);
	}

	return { ok: true };
}

function filterRemoteDevicesForOperation(
	devices: RemoteUsbngDevice[],
	operation: "connect" | "disconnect",
): RemoteUsbngDevice[] {
	return devices.filter((device) =>
		operation === "connect" ? device.state === "remote" : device.state === "connected",
	);
}

function mapAdapterError(operation: DeviceOperation, deviceName: string, error: unknown): DeviceActionExecutionResult {
	if (error instanceof UsbngNotAvailableError) {
		return {
			error: "USB Network Gate is not available on this machine.",
			ok: false,
		};
	}

	return {
		detail: getErrorMessage(error),
		error: `Could not ${operation} "${deviceName}".`,
		ok: false,
	};
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
