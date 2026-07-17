import { describe, expect, it, vi } from "vitest";

import { createUsbngPlatformAdapter } from "./platform";

describe("createUsbngPlatformAdapter", () => {
	it("resolves darwin to the macOS adapter factory", () => {
		const macosAdapter = {
			connectDevice: vi.fn(),
			disconnectDevice: vi.fn(),
			listLocalDevices: vi.fn(),
			listRemoteDevices: vi.fn(),
			shareDevice: vi.fn(),
			unshareDevice: vi.fn(),
		};

		const adapter = createUsbngPlatformAdapter({
			createMacosAdapter: () => macosAdapter,
			platform: "darwin",
		});

		expect(adapter).toBe(macosAdapter);
	});

	it("resolves win32 to the Windows adapter factory", () => {
		const windowsAdapter = {
			connectDevice: vi.fn(),
			disconnectDevice: vi.fn(),
			listLocalDevices: vi.fn(),
			listRemoteDevices: vi.fn(),
			shareDevice: vi.fn(),
			unshareDevice: vi.fn(),
		};

		const adapter = createUsbngPlatformAdapter({
			createWindowsAdapter: () => windowsAdapter,
			platform: "win32",
		});

		expect(adapter).toBe(windowsAdapter);
	});

	it("throws an explicit error for unsupported platforms", () => {
		expect(() =>
			createUsbngPlatformAdapter({
				createMacosAdapter: () => {
					throw new Error("unreachable");
				},
				platform: "linux",
			}),
		).toThrow("USB Link does not support linux.");
	});
});
