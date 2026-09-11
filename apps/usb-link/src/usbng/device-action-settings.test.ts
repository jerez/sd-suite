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

	it("prefers a stable device id while retaining the visible name", () => {
		expect(
			parseDeviceActionSettings({
				deviceId: "  32-2.2.1  ",
				deviceName: "  Stream Deck Plus  ",
			}),
		).toEqual({
			ok: true,
			value: {
				deviceId: "32-2.2.1",
				deviceName: "Stream Deck Plus",
			},
		});
	});

	it("rejects empty device settings", () => {
		expect(
			parseDeviceActionSettings({
				deviceName: "   ",
			}),
		).toEqual({
			error: "Device is required.",
			ok: false,
		});
	});

	it("accepts a device id when no label was persisted", () => {
		expect(parseDeviceActionSettings({ deviceId: "32-2.2.1" })).toEqual({
			ok: true,
			value: {
				deviceId: "32-2.2.1",
				deviceName: "32-2.2.1",
			},
		});
	});
});
