import { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";

import type { DeviceActionSettings } from "../usbng/device-types";
import { type DeviceOptionsMessage, runDeviceAction, sendDeviceOptions } from "./device-action-runner";

/**
 * Stream Deck action that stops sharing a local USB device through USBNG.
 */
@action({ UUID: "dev.jerez.sds.usb-link.unshare-device" })
export class UnshareDevice extends SingletonAction<DeviceActionSettings> {
	override async onSendToPlugin(ev: SendToPluginEvent<DeviceOptionsMessage, DeviceActionSettings>): Promise<void> {
		await sendDeviceOptions(ev.payload, "unshare");
	}

	override async onKeyDown(ev: KeyDownEvent<DeviceActionSettings>): Promise<void> {
		await runDeviceAction({
			action: ev.action,
			operation: "unshare",
			settings: ev.payload.settings,
		});
	}
}
