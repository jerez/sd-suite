import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsbngPlatformAdapter } from "../usbng/platform-adapter";

const mocks = vi.hoisted(() => ({
	adapter: {
		connectDevice: vi.fn(async () => undefined),
		disconnectDevice: vi.fn(async () => undefined),
		listLocalDevices: vi.fn(async () => []),
		listRemoteDevices: vi.fn(async () => [
			{ id: "usbng-server.example.test:56228", name: "Stream Deck Plus", state: "remote" as const },
			{ id: "usbng-server.example.test:60222", name: "Brio 101", state: "connected" as const },
		]),
		listSharedDevices: vi.fn(async () => []),
		shareDevice: vi.fn(async () => undefined),
		unshareDevice: vi.fn(async () => undefined),
	} satisfies UsbngPlatformAdapter,
	sendToPropertyInspector: vi.fn(async () => undefined),
}));

vi.mock("@elgato/streamdeck", () => ({
	default: {
		logger: { warn: vi.fn() },
		ui: { sendToPropertyInspector: mocks.sendToPropertyInspector },
	},
	action: () => (target: unknown) => target,
	SingletonAction: class {},
}));

vi.mock("../usbng/platform", () => ({
	createUsbngPlatformAdapter: () => mocks.adapter,
}));

import { ConnectDevice } from "./connect-device";
import { DisconnectDevice } from "./disconnect-device";

type SettingsChangeHandler = {
	onDidReceiveSettings(event: unknown): Promise<void>;
};

describe.each([
	["connect", ConnectDevice, [{ label: "Stream Deck Plus", value: "usbng-server.example.test:56228" }]],
	["disconnect", DisconnectDevice, [{ label: "Brio 101", value: "usbng-server.example.test:60222" }]],
] as const)("%s device action", (_operation, ActionClass, items) => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("pushes refreshed device options after action settings change", async () => {
		const action = new ActionClass() as unknown as SettingsChangeHandler;

		await action.onDidReceiveSettings({
			payload: { settings: { remoteServer: "usbng-server.example.test" } },
		});

		expect(mocks.sendToPropertyInspector).toHaveBeenCalledWith({
			event: "getUsbDevices",
			items,
		});
	});
});
