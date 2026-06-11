type NamedDevice = {
	name: string;
};

/**
 * Result of attempting to resolve a single device from a list by name.
 */
export type DeviceMatchResult<TDevice> = { ok: true; value: TDevice } | { error: string; ok: false };

/**
 * Resolves a device by name, preferring an exact trimmed match before falling
 * back to a case-insensitive comparison. Ambiguous matches are rejected.
 */
export function matchDeviceByName<TDevice extends NamedDevice>(
	devices: TDevice[],
	deviceName: string,
): DeviceMatchResult<TDevice> {
	const normalizedDeviceName = deviceName.trim();
	const exactMatches = findExactMatches(devices, normalizedDeviceName);
	if (exactMatches.length === 1) {
		const [device] = exactMatches;
		if (device) {
			return { ok: true, value: device };
		}
	}
	if (exactMatches.length > 1) {
		return duplicateDeviceError(normalizedDeviceName);
	}

	const caseInsensitiveMatches = devices.filter(
		(device) => normalizeDeviceName(device.name).toLocaleLowerCase() === normalizedDeviceName.toLocaleLowerCase(),
	);
	if (caseInsensitiveMatches.length === 1) {
		const [device] = caseInsensitiveMatches;
		if (device) {
			return { ok: true, value: device };
		}
	}
	if (caseInsensitiveMatches.length > 1) {
		return duplicateDeviceError(normalizedDeviceName);
	}

	return {
		error: `No USB device named "${normalizedDeviceName}" was found.`,
		ok: false,
	};
}

function findExactMatches<TDevice extends NamedDevice>(devices: TDevice[], deviceName: string): TDevice[] {
	return devices.filter((device) => normalizeDeviceName(device.name) === deviceName);
}

function normalizeDeviceName(deviceName: string): string {
	return deviceName.trim();
}

function duplicateDeviceError<TDevice>(deviceName: string): DeviceMatchResult<TDevice> {
	return {
		error: `Multiple USB devices named "${deviceName}" were found.`,
		ok: false,
	};
}
