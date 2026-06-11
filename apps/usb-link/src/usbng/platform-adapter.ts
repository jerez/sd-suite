import type { LocalUsbngDevice, RemoteUsbngDevice } from "./device-types";

export interface UsbngPlatformAdapter {
	listLocalDevices(): Promise<LocalUsbngDevice[]>;
	listRemoteDevices(): Promise<RemoteUsbngDevice[]>;
	shareDevice(device: LocalUsbngDevice): Promise<void>;
	unshareDevice(device: LocalUsbngDevice): Promise<void>;
	connectDevice(device: RemoteUsbngDevice): Promise<void>;
	disconnectDevice(device: RemoteUsbngDevice): Promise<void>;
}

export class UsbngNotAvailableError extends Error {
	constructor(message = "USB Network Gate is not available on this machine.") {
		super(message);
		this.name = "UsbngNotAvailableError";
	}
}
