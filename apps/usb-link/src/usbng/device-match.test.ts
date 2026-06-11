import { describe, expect, it } from "vitest";

import { matchDeviceByName } from "./device-match";

describe("matchDeviceByName", () => {
	it("returns the exact matching device", () => {
		expect(
			matchDeviceByName(
				[
					{ id: "32-2.2.1", name: "Brio 101" },
					{ id: "32-2.2.4.1", name: "BlackShark V3 Pro Xbox" },
				],
				"Brio 101",
			),
		).toEqual({
			ok: true,
			value: { id: "32-2.2.1", name: "Brio 101" },
		});
	});

	it("returns an explicit error when the device is missing", () => {
		expect(
			matchDeviceByName(
				[
					{ id: "32-2.2.1", name: "Brio 101" },
					{ id: "32-2.2.4.1", name: "BlackShark V3 Pro Xbox" },
				],
				"Stream Deck Plus",
			),
		).toEqual({
			error: 'No USB device named "Stream Deck Plus" was found.',
			ok: false,
		});
	});

	it("returns an explicit error when duplicate visible names exist", () => {
		expect(
			matchDeviceByName(
				[
					{ id: "32-2.2.1", name: "Brio 101" },
					{ id: "32-2.2.2", name: "Brio 101" },
				],
				"Brio 101",
			),
		).toEqual({
			error: 'Multiple USB devices named "Brio 101" were found.',
			ok: false,
		});
	});
});
