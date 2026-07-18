import { DeviceDialRenderer } from "./device-dial-renderer";

const ENCODER_LAYOUT = "layouts/output-device.json";
const NO_INPUT_TITLE = "No Input";

export class InputDeviceDialRenderer extends DeviceDialRenderer {
  constructor() {
    super({
      layout: ENCODER_LAYOUT,
      noDeviceTitle: NO_INPUT_TITLE,
      iconScope: "input",
    });
  }
}
