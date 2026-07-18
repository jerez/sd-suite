import { getAudioDevices, getDefaultDevice, refreshDevices, setDefaultDevice } from "../audio";
import { DeviceSwitcher, type DeviceSwitcherApi } from "./device-switcher";

const NO_OUTPUT_TITLE = "No Output";

export class OutputDeviceSwitcher extends DeviceSwitcher {
  constructor(api?: Partial<DeviceSwitcherApi>) {
    super({
      api: {
        getAudioDevices: api?.getAudioDevices ?? getAudioDevices,
        getDefaultDevice: api?.getDefaultDevice ?? getDefaultDevice,
        setDefaultDevice: api?.setDefaultDevice ?? setDefaultDevice,
        refreshDevices: api?.refreshDevices ?? refreshDevices,
      },
      noDeviceTitle: NO_OUTPUT_TITLE,
    });
  }
}
