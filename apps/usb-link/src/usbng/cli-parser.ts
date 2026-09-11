import type { LocalUsbngDevice, RemoteUsbngDevice, RemoteUsbngDeviceState } from "./device-types";

const LOCAL_DEVICE_PATTERN = /^local\s+([^,]+),.*product '(.*)', manuf\./;
const NETWORK_DEVICE_PATTERN = /^(remote|connected|disconnected)\s+(.+)$/;
// The device name lives in the seventh CSV-like field emitted by `eveusbc ls net`.
// Limitation: the CLI emits these fields comma-separated without quoting, so a
// device name that itself contains a comma cannot be recovered unambiguously and
// will be truncated at the first comma. USB device names rarely contain commas.
const NETWORK_DEVICE_NAME_INDEX = 6;
const NETWORK_DEVICE_HOST_INDEX = 0;
const NETWORK_DEVICE_PORT_INDEX = 2;
const SHARED_DEVICE_ID_INDEX = 4;
const SHARED_DEVICE_NAME_INDEX = 6;

/**
 * Parses local-device rows returned by `eveusbc ls local`.
 */
export function parseLocalUsbngDevices(output: string): LocalUsbngDevice[] {
	return splitUsbngOutput(output).flatMap((line) => {
		const match = line.match(LOCAL_DEVICE_PATTERN);
		if (!match) {
			return [];
		}

		const [, rawId, rawName] = match;
		if (!rawId || !rawName) {
			return [];
		}

		return [
			{
				id: rawId.trim(),
				name: rawName.trim(),
			},
		];
	});
}

/**
 * Parses network-device rows returned by `eveusbc ls net`.
 */
export function parseNetworkUsbngDevices(output: string): RemoteUsbngDevice[] {
	return splitUsbngOutput(output).flatMap((line) => {
		const match = line.match(NETWORK_DEVICE_PATTERN);
		if (!match) {
			return [];
		}

		const [, rawState, rawId] = match;
		if (!rawState || !rawId) {
			return [];
		}

		const fields = rawId.split(",");
		const host = fields[NETWORK_DEVICE_HOST_INDEX]?.trim();
		const port = fields[NETWORK_DEVICE_PORT_INDEX]?.trim();
		const name = fields[NETWORK_DEVICE_NAME_INDEX]?.trim();
		if (!host || !port || !name) {
			return [];
		}

		return [
			{
				id: `${host}:${port}`,
				name,
				state: toRemoteDeviceState(rawState),
			},
		];
	});
}

/**
 * Parses shared local-device rows returned by `eveusbc ls shared`.
 */
export function parseSharedUsbngDevices(output: string): LocalUsbngDevice[] {
	return splitUsbngOutput(output).flatMap((line) => {
		if (!line.startsWith("shared ")) {
			return [];
		}

		const fields = line.slice("shared ".length).split(",");
		const id = fields[SHARED_DEVICE_ID_INDEX]?.trim();
		const name = fields[SHARED_DEVICE_NAME_INDEX]?.trim();
		return id && name ? [{ id, name }] : [];
	});
}

function splitUsbngOutput(output: string): string[] {
	return output
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function toRemoteDeviceState(rawState: string): RemoteUsbngDeviceState {
	// `disconnected` still represents a connectable remote device in the shared action model.
	return rawState === "connected" ? "connected" : "remote";
}
