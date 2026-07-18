import { DeviceDialRenderer } from "./device-dial-renderer";

const ENCODER_LAYOUT = "layouts/output-device.json";
const NO_OUTPUT_TITLE = "No Output";

export class OutputDeviceDialRenderer extends DeviceDialRenderer {
	constructor() {
		super({
			layout: ENCODER_LAYOUT,
			noDeviceTitle: NO_OUTPUT_TITLE,
			iconScope: "output",
		});
	}
}
