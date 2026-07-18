import { describe, expect, it } from "vitest";

import { renderAudioDeviceIcon } from "./audio-device-icon";

function decodeSvg(uri: string): string {
	const prefix = "data:image/svg+xml;utf8,";
	return decodeURIComponent(uri.slice(prefix.length));
}

describe("renderAudioDeviceIcon", () => {
	it("uses a microphone icon for input devices with unknown form factor", () => {
		const inputUnknown = decodeSvg(
			renderAudioDeviceIcon({
				scope: "input",
				formFactor: "unknown",
				size: 38,
			}),
		);

		const outputUnknown = decodeSvg(
			renderAudioDeviceIcon({
				scope: "output",
				formFactor: "unknown",
				size: 38,
			}),
		);

		expect(inputUnknown).toContain('<path d="M12 19v3"></path>');
		expect(inputUnknown).toContain('<rect x="9" y="2" width="6" height="13" rx="3"></rect>');
		expect(inputUnknown).not.toEqual(outputUnknown);
	});

	it("keeps headphones icon for explicit headphones form factor on input", () => {
		const inputHeadphones = renderAudioDeviceIcon({
			scope: "input",
			formFactor: "headphones",
			size: 38,
		});

		const outputHeadphones = renderAudioDeviceIcon({
			scope: "output",
			formFactor: "headphones",
			size: 38,
		});

		expect(inputHeadphones).toEqual(outputHeadphones);
	});

	it("renders unknown output devices with external transport as speakers", () => {
		const unknownExternalOutput = renderAudioDeviceIcon({
			scope: "output",
			formFactor: "unknown",
			transportType: "usb",
			size: 38,
		});

		const outputSpeakers = renderAudioDeviceIcon({
			scope: "output",
			formFactor: "speakers",
			size: 38,
		});

		expect(unknownExternalOutput).toEqual(outputSpeakers);
	});

	it("uses unavailable icon when device is disabled", () => {
		const disabledIcon = decodeSvg(
			renderAudioDeviceIcon({
				scope: "output",
				formFactor: "speakers",
				isDisabled: true,
				size: 38,
			}),
		);
		const normalIcon = decodeSvg(
			renderAudioDeviceIcon({
				scope: "output",
				formFactor: "speakers",
				size: 38,
			}),
		);
		const inputDisabledIcon = decodeSvg(
			renderAudioDeviceIcon({
				scope: "input",
				formFactor: "unknown",
				isDisabled: true,
				size: 38,
			}),
		);

		expect(disabledIcon).not.toEqual(normalIcon);
		expect(disabledIcon).not.toEqual(inputDisabledIcon);
	});

	it("uses unavailable icon when device is muted", () => {
		const mutedIcon = decodeSvg(
			renderAudioDeviceIcon({
				scope: "output",
				formFactor: "speakers",
				isMuted: true,
				size: 38,
			}),
		);
		const disabledIcon = decodeSvg(
			renderAudioDeviceIcon({
				scope: "output",
				formFactor: "speakers",
				isDisabled: true,
				size: 38,
			}),
		);

		expect(mutedIcon).toEqual(disabledIcon);
	});
});
