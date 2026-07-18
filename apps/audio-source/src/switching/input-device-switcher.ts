import {
  getAudioInputDevices,
  getDefaultInputDevice,
  refreshInputDevices,
  setDefaultInputDevice,
} from "../audio";
import { DeviceSwitcher, type DeviceSwitcherApi } from "./device-switcher";

const NO_INPUT_TITLE = "No Input";

export class InputDeviceSwitcher extends DeviceSwitcher {
  constructor(api?: Partial<DeviceSwitcherApi>) {
    super({
      api: {
        getAudioDevices: api?.getAudioDevices ?? getAudioInputDevices,
        getDefaultDevice: api?.getDefaultDevice ?? getDefaultInputDevice,
        setDefaultDevice: api?.setDefaultDevice ?? setDefaultInputDevice,
        refreshDevices: api?.refreshDevices ?? refreshInputDevices,
      },
      noDeviceTitle: NO_INPUT_TITLE,
    });
  }
}
