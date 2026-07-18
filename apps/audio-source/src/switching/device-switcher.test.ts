import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceSwitcher, type DeviceSwitcherApi } from "./device-switcher";
import type { AudioDevice } from "../audio/types";

describe("DeviceSwitcher", () => {
	let switcher: DeviceSwitcher;
	let api: DeviceSwitcherApi;

	const mockDevices: AudioDevice[] = [
		{ id: "device-1", name: "Speakers" },
		{ id: "device-2", name: "Headphones" },
		{ id: "device-3", name: "USB Audio" },
	];

	beforeEach(() => {
		api = {
			getAudioDevices: vi.fn().mockResolvedValue(mockDevices),
			getDefaultDevice: vi.fn().mockResolvedValue(mockDevices[0]),
			setDefaultDevice: vi.fn().mockResolvedValue(undefined),
			refreshDevices: vi.fn().mockResolvedValue(undefined),
		};

		switcher = new DeviceSwitcher({
			api,
			noDeviceTitle: "No Device",
		});
	});

	it("initializes and returns active device name", async () => {
		const result = await switcher.initialize("action-1");

		expect(result).toBe("Speakers");
	});

	it("uses fallback title when default device is missing", async () => {
		vi.mocked(api.getDefaultDevice).mockResolvedValue(null);

		const result = await switcher.getActiveName();

		expect(result).toBe("No Device");
	});

	it("previews next and previous devices", async () => {
		const next = await switcher.preview("action-1", 1);
		const previous = await switcher.preview("action-1", -1);

		expect(next).toEqual({ selectedId: "device-2", selectedName: "Headphones", direction: 1 });
		expect(previous).toEqual({
			selectedId: "device-1",
			selectedName: "Speakers",
			direction: -1,
		});
	});

	it("reuses existing pending state without re-reading default device", async () => {
		await switcher.preview("action-1", 1);
		await switcher.preview("action-1", 1);

		expect(api.getDefaultDevice).toHaveBeenCalledTimes(1);
	});

	it("re-reads default device when device ids change", async () => {
		await switcher.preview("action-1", 1);

		vi.mocked(api.getAudioDevices).mockResolvedValue([
			{ id: "device-1", name: "Speakers" },
			{ id: "device-2", name: "Headphones" },
			{ id: "device-4", name: "HDMI" },
		]);

		await switcher.preview("action-1", 1);

		expect(api.getDefaultDevice).toHaveBeenCalledTimes(2);
	});

	it("returns fallback selection for empty device list", async () => {
		vi.mocked(api.getAudioDevices).mockResolvedValue([]);

		const result = await switcher.preview("action-1", 1);

		expect(result).toEqual({ selectedId: "none", selectedName: "No Device", direction: 1 });
	});

	it("confirms previewed device", async () => {
		await switcher.preview("action-1", 1);
		const result = await switcher.confirm("action-1");

		expect(api.setDefaultDevice).toHaveBeenCalledWith("device-2");
		expect(result.changed).toBe(true);
	});

	it("reverts without changing default device", async () => {
		await switcher.preview("action-1", 1);
		await switcher.revert("action-1");

		expect(api.setDefaultDevice).not.toHaveBeenCalled();
	});

	it("attempts to apply disabled selected devices", async () => {
		vi.mocked(api.getAudioDevices).mockResolvedValue([
			{ id: "device-1", name: "Speakers" },
			{ id: "device-2", name: "Disabled Headphones", isDisabled: true },
		]);

		await switcher.preview("action-1", 1);
		const result = await switcher.confirm("action-1");

		expect(api.setDefaultDevice).toHaveBeenCalledWith("device-2");
		expect(result.changed).toBe(true);
	});
});
