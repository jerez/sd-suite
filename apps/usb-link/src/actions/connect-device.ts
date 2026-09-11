import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
} from "@elgato/streamdeck";

import type { DeviceActionSettings } from "../usbng/device-types";
import { type DeviceOptionsMessage, runDeviceAction, sendDeviceOptions } from "./device-action-runner";

/**
 * Stream Deck action that connects the local machine to a remote USBNG device.
 */
@action({ UUID: "dev.jerez.sds.usb-link.connect-device" })
export class ConnectDevice extends SingletonAction<DeviceActionSettings> {
	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DeviceActionSettings>): Promise<void> {
		await sendDeviceOptions({ event: "getUsbDevices", isRefresh: true }, "connect", ev.payload.settings.remoteServer);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<DeviceOptionsMessage, DeviceActionSettings>): Promise<void> {
		const settings = await ev.action.getSettings<DeviceActionSettings>();
		await sendDeviceOptions(ev.payload, "connect", settings.remoteServer);
	}

	override async onKeyDown(ev: KeyDownEvent<DeviceActionSettings>): Promise<void> {
		await runDeviceAction({
			action: ev.action,
			operation: "connect",
			settings: ev.payload.settings,
		});
	}
}
