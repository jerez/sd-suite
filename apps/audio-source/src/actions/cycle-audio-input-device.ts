import { action } from "@elgato/streamdeck";

import {
	getAudioInputDevices,
	getDefaultInputDevice,
	setDefaultInputDevice,
	subscribeDefaultInputDeviceChanges,
} from "../audio";
import { CycleAudioDeviceAction } from "./cycle-audio-device-action";
import { InputDeviceDialRenderer } from "../layout/input-device-dial-renderer";
import { InputDeviceSwitcher } from "../switching/input-device-switcher";

const NO_INPUT_TITLE = "No Input";

@action({ UUID: "dev.jerez.sds.audio-source.cycle-audio-input" })
export class CycleAudioInputDevice extends CycleAudioDeviceAction {
	constructor() {
		super({
			noDeviceTitle: NO_INPUT_TITLE,
			switcher: new InputDeviceSwitcher({
				getAudioDevices: () => this.getCachedAudioDevices(),
				getDefaultDevice: () => this.getCachedDefaultDevice(),
				setDefaultDevice: async (deviceId) => {
					await setDefaultInputDevice(deviceId);
					this.invalidateDeviceCache();
				},
			}),
			renderer: new InputDeviceDialRenderer(),
			getAudioDevices: getAudioInputDevices,
			getDefaultDevice: getDefaultInputDevice,
			subscribeDefaultDeviceChanges: subscribeDefaultInputDeviceChanges,
		});
	}
}
