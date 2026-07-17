import type { DeviceActionSettings, ParsedDeviceActionSettings } from "./device-types";

/**
 * Result of validating and normalizing raw Stream Deck action settings.
 */
export type DeviceActionSettingsParseResult =
	| { ok: true; value: ParsedDeviceActionSettings }
	| { error: string; ok: false };

/**
 * Validates the user-provided device name and returns a trimmed value that is
 * safe to use for device matching.
 */
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
