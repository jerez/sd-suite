import type { LocalUsbngDevice, RemoteUsbngDevice, RemoteUsbngDeviceState } from "./device-types";

const LOCAL_DEVICE_PATTERN = /^local\s+([^,]+),.*product '(.*)', manuf\./;
const NETWORK_DEVICE_PATTERN = /^(remote|connected|disconnected)\s+(.+)$/;
// The device name lives in the seventh CSV-like field emitted by `eveusbc ls net`.
const NETWORK_DEVICE_NAME_INDEX = 6;

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
		const name = fields[NETWORK_DEVICE_NAME_INDEX]?.trim();
		if (!name) {
			return [];
		}

		return [
			{
				id: rawId,
				name,
				state: toRemoteDeviceState(rawState),
			},
		];
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
