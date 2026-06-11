import type { LocalUsbngDevice, RemoteUsbngDevice } from "./device-types";

/**
 * OS-specific bridge used by the shared USBNG action core.
 */
export interface UsbngPlatformAdapter {
	/**
	 * Lists local devices that can be shared or unshared on this machine.
	 */
	listLocalDevices(): Promise<LocalUsbngDevice[]>;
	/**
	 * Lists remote devices that can be connected or disconnected on this machine.
	 */
	listRemoteDevices(): Promise<RemoteUsbngDevice[]>;
	/**
	 * Shares a local USB device through the local USBNG service.
	 */
	shareDevice(device: LocalUsbngDevice): Promise<void>;
	/**
	 * Stops sharing a local USB device through the local USBNG service.
	 */
	unshareDevice(device: LocalUsbngDevice): Promise<void>;
	/**
	 * Connects the current machine to a remote USB device exposed by USBNG.
	 */
	connectDevice(device: RemoteUsbngDevice): Promise<void>;
	/**
	 * Disconnects the current machine from a remote USB device exposed by USBNG.
	 */
	disconnectDevice(device: RemoteUsbngDevice): Promise<void>;
}

/**
 * Raised when the platform-specific USBNG tooling is not installed or cannot be found.
 */
export class UsbngNotAvailableError extends Error {
	constructor(message = "USB Network Gate is not available on this machine.") {
		super(message);
		this.name = "UsbngNotAvailableError";
	}
}
