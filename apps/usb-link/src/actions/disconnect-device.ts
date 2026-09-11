import { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";

import type { DeviceActionSettings } from "../usbng/device-types";
import { type DeviceOptionsMessage, runDeviceAction, sendDeviceOptions } from "./device-action-runner";

/**
 * Stream Deck action that disconnects the local machine from a remote USBNG device.
 */
@action({ UUID: "dev.jerez.sds.usb-link.disconnect-device" })
export class DisconnectDevice extends SingletonAction<DeviceActionSettings> {
	override async onSendToPlugin(ev: SendToPluginEvent<DeviceOptionsMessage, DeviceActionSettings>): Promise<void> {
		const settings = await ev.action.getSettings<DeviceActionSettings>();
		await sendDeviceOptions(ev.payload, "disconnect", settings.remoteServer);
	}

	override async onKeyDown(ev: KeyDownEvent<DeviceActionSettings>): Promise<void> {
		await runDeviceAction({
			action: ev.action,
			operation: "disconnect",
			settings: ev.payload.settings,
		});
	}
}
