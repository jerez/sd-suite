export type DeviceActionSettings = {
	deviceName?: string;
};

export type ParsedDeviceActionSettings = {
	deviceName: string;
};

export type DeviceOperation = "share" | "unshare" | "connect" | "disconnect";

export type LocalUsbngDevice = {
	id: string;
	name: string;
};

export type RemoteUsbngDeviceState = "remote" | "connected";

export type RemoteUsbngDevice = {
	id: string;
	name: string;
	state: RemoteUsbngDeviceState;
};
