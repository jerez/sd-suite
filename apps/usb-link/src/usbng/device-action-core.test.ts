import { describe, expect, it, vi } from "vitest";

import { executeDeviceAction } from "./device-action-core";
import { UsbngNotAvailableError, type UsbngPlatformAdapter } from "./platform-adapter";

function createAdapter(overrides: Partial<UsbngPlatformAdapter> = {}): UsbngPlatformAdapter {
	return {
		connectDevice: vi.fn().mockResolvedValue(undefined),
		disconnectDevice: vi.fn().mockResolvedValue(undefined),
		listLocalDevices: vi.fn().mockResolvedValue([]),
		listRemoteDevices: vi.fn().mockResolvedValue([]),
		shareDevice: vi.fn().mockResolvedValue(undefined),
		unshareDevice: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("executeDeviceAction", () => {
	it("shares one matched local device", async () => {
		const adapter = createAdapter({
			listLocalDevices: vi.fn().mockResolvedValue([{ id: "32-2.2.1", name: "Brio 101" }]),
			shareDevice: vi.fn().mockResolvedValue(undefined),
		});

		const result = await executeDeviceAction({
			adapter,
			operation: "share",
			settings: {
				deviceName: "  Brio 101  ",
			},
		});

		expect(result).toEqual({ ok: true });
		expect(adapter.listLocalDevices).toHaveBeenCalledOnce();
		expect(adapter.shareDevice).toHaveBeenCalledWith({ id: "32-2.2.1", name: "Brio 101" });
	});

	it("returns a validation error when the device name is missing", async () => {
		const adapter = createAdapter();

		const result = await executeDeviceAction({
			adapter,
			operation: "share",
			settings: {},
		});

		expect(result).toEqual({
			error: "Device name is required.",
			ok: false,
		});
	});

	it("maps adapter availability errors to a stable user-facing message", async () => {
		const adapter = createAdapter({
			listLocalDevices: vi.fn().mockRejectedValue(new UsbngNotAvailableError("eveusbc missing")),
		});

		const result = await executeDeviceAction({
			adapter,
			operation: "share",
			settings: {
				deviceName: "Brio 101",
			},
		});

		expect(result).toEqual({
			error: "USB Network Gate is not available on this machine.",
			ok: false,
		});
	});

	it("filters connected devices when disconnecting by name", async () => {
		const adapter = createAdapter({
			disconnectDevice: vi.fn().mockResolvedValue(undefined),
			listRemoteDevices: vi.fn().mockResolvedValue([
				{ id: "remote-stream-deck", name: "Stream Deck Plus", state: "remote" },
				{ id: "connected-stream-deck", name: "Stream Deck Plus", state: "connected" },
			]),
		});

		const result = await executeDeviceAction({
			adapter,
			operation: "disconnect",
			settings: {
				deviceName: "Stream Deck Plus",
			},
		});

		expect(result).toEqual({ ok: true });
		expect(adapter.disconnectDevice).toHaveBeenCalledWith({
			id: "connected-stream-deck",
			name: "Stream Deck Plus",
			state: "connected",
		});
	});
});
