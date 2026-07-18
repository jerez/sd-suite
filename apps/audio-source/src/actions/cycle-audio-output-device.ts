import { action } from "@elgato/streamdeck";

import { getAudioDevices, getDefaultDevice, setDefaultDevice, subscribeDefaultDeviceChanges } from "../audio";
import { CycleAudioDeviceAction } from "./cycle-audio-device-action";
import { OutputDeviceDialRenderer } from "../layout/output-device-dial-renderer";
import { OutputDeviceSwitcher } from "../switching/output-device-switcher";

const NO_OUTPUT_TITLE = "No Output";

@action({ UUID: "dev.jerez.sds.audio-source.cycle-audio-output" })
export class CycleAudioOutputDevice extends CycleAudioDeviceAction {
	constructor() {
		super({
			noDeviceTitle: NO_OUTPUT_TITLE,
			switcher: new OutputDeviceSwitcher({
				getAudioDevices: () => this.getCachedAudioDevices(),
				getDefaultDevice: () => this.getCachedDefaultDevice(),
				setDefaultDevice: async (deviceId) => {
					await setDefaultDevice(deviceId);
					this.invalidateDeviceCache();
				},
			}),
			renderer: new OutputDeviceDialRenderer(),
			getAudioDevices,
			getDefaultDevice,
			subscribeDefaultDeviceChanges,
		});
	}
}
