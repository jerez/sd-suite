import { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";

import type { DeviceActionSettings } from "../usbng/device-types";
import { type DeviceOptionsMessage, runDeviceAction, sendDeviceOptions } from "./device-action-runner";

/**
 * Stream Deck action that shares a local USB device through USBNG.
 */
@action({ UUID: "dev.jerez.sds.usb-link.share-device" })
export class ShareDevice extends SingletonAction<DeviceActionSettings> {
	override async onSendToPlugin(ev: SendToPluginEvent<DeviceOptionsMessage, DeviceActionSettings>): Promise<void> {
		await sendDeviceOptions(ev.payload, "share");
	}

	override async onKeyDown(ev: KeyDownEvent<DeviceActionSettings>): Promise<void> {
		await runDeviceAction({
			action: ev.action,
			operation: "share",
			settings: ev.payload.settings,
		});
	}
}
