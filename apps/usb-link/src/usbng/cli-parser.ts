import type { LocalUsbngDevice, RemoteUsbngDevice, RemoteUsbngDeviceState } from "./device-types";

const LOCAL_DEVICE_PATTERN = /^local\s+([^,]+),.*product '(.*)', manuf\./;
const NETWORK_DEVICE_PATTERN = /^(remote|connected|disconnected)\s+(.+)$/;
const NETWORK_DEVICE_NAME_INDEX = 6;

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
	return rawState === "connected" ? "connected" : "remote";
}
