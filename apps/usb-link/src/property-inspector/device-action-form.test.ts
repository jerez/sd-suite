import { describe, expect, it } from "vitest";

import { validateDeviceActionForm } from "./device-action-form";

describe("validateDeviceActionForm", () => {
	it("accepts a configured device name", () => {
		expect(
			validateDeviceActionForm({
				deviceName: "Stream Deck Plus",
			}),
		).toEqual({ ok: true });
	});

	it("rejects an empty device name", () => {
		expect(
			validateDeviceActionForm({
				deviceName: "   ",
			}),
		).toEqual({
			error: "Device name is required.",
			ok: false,
		});
	});
});
