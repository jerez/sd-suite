import { action, type KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

import type { DeviceActionSettings } from "../usbng/device-types";
import { runDeviceAction } from "./device-action-runner";

@action({ UUID: "dev.jerez.sds.usb-link.unshare-device" })
export class UnshareDevice extends SingletonAction<DeviceActionSettings> {
	override async onKeyDown(ev: KeyDownEvent<DeviceActionSettings>): Promise<void> {
		await runDeviceAction({
			action: ev.action,
			operation: "unshare",
			settings: ev.payload.settings,
		});
	}
}
