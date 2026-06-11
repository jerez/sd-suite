import type { DeviceActionSettings, ParsedDeviceActionSettings } from "./device-types";

export type DeviceActionSettingsParseResult =
	| { ok: true; value: ParsedDeviceActionSettings }
	| { error: string; ok: false };

export function parseDeviceActionSettings(settings: DeviceActionSettings): DeviceActionSettingsParseResult {
	const deviceName = settings.deviceName?.trim();
	if (!deviceName) {
		return { error: "Device name is required.", ok: false };
	}

	return {
		ok: true,
		value: {
			deviceName,
		},
	};
}
