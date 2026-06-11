/**
 * Raw action settings persisted by Stream Deck for a single USB Link action.
 */
export type DeviceActionSettings = {
	deviceName?: string;
};

/**
 * Normalized action settings after validation succeeds.
 */
export type ParsedDeviceActionSettings = {
	deviceName: string;
};

/**
 * USB Link actions supported by the shared USBNG action core.
 */
export type DeviceOperation = "share" | "unshare" | "connect" | "disconnect";

/**
 * Local USB device visible to the USBNG instance on the current machine.
 */
export type LocalUsbngDevice = {
	id: string;
	name: string;
};

/**
 * States exposed by the action core for remote devices.
 */
export type RemoteUsbngDeviceState = "remote" | "connected";

/**
 * Remote USB device visible to the USBNG instance on the current machine.
 */
export type RemoteUsbngDevice = {
	id: string;
	name: string;
	state: RemoteUsbngDeviceState;
};
