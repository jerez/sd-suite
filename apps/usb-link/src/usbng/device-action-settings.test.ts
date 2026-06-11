import { describe, expect, it } from "vitest";

import { parseDeviceActionSettings } from "./device-action-settings";

describe("parseDeviceActionSettings", () => {
	it("trims the configured device name", () => {
		expect(
			parseDeviceActionSettings({
				deviceName: "  Stream Deck Plus  ",
			}),
		).toEqual({
			ok: true,
			value: {
				deviceName: "Stream Deck Plus",
			},
		});
	});

	it("rejects an empty device name", () => {
		expect(
			parseDeviceActionSettings({
				deviceName: "   ",
			}),
		).toEqual({
			error: "Device name is required.",
			ok: false,
		});
	});
});
