import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runDeviceAction } from "./device-action-runner";
import type { UsbngPlatformAdapter } from "../usbng/platform-adapter";

function createActionHandle() {
	return {
		setImage: vi.fn(async () => undefined),
		showAlert: vi.fn(async () => undefined),
		showOk: vi.fn(async () => undefined),
	};
}

function createAdapterStub(): UsbngPlatformAdapter {
	return {
		connectDevice: vi.fn(async () => undefined),
		disconnectDevice: vi.fn(async () => undefined),
		listLocalDevices: vi.fn(async () => []),
		listRemoteDevices: vi.fn(async () => []),
		shareDevice: vi.fn(async () => undefined),
		unshareDevice: vi.fn(async () => undefined),
	};
}

describe("runDeviceAction", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows active then success feedback and restores the default image", async () => {
		const action = createActionHandle();
		const adapter = createAdapterStub();
		const createPlatformAdapter = vi.fn(() => adapter);
		const executeAction = vi.fn().mockResolvedValue({ ok: true });

		await runDeviceAction({
			action,
			createPlatformAdapter,
			executeAction,
			operation: "share",
			settings: {
				deviceName: "Stream Deck Plus",
			},
		});

		expect(createPlatformAdapter).toHaveBeenCalledOnce();
		expect(executeAction).toHaveBeenCalledWith({
			adapter,
			operation: "share",
			settings: {
				deviceName: "Stream Deck Plus",
			},
		});
		expect(action.showOk).toHaveBeenCalledOnce();
		expect(action.showAlert).not.toHaveBeenCalled();
		expect(action.setImage).toHaveBeenNthCalledWith(1, "imgs/states/active.svg");
		expect(action.setImage).toHaveBeenNthCalledWith(2, "imgs/states/success.svg");

		vi.advanceTimersByTime(1_200);
		await vi.runAllTimersAsync();

		expect(action.setImage).toHaveBeenNthCalledWith(3, undefined);
	});

	it("shows error feedback, alerts, and logs failures", async () => {
		const action = createActionHandle();
		const createPlatformAdapter = vi.fn(() => createAdapterStub());
		const executeAction = vi.fn().mockResolvedValue({
			detail: "Underlying CLI returned: Error: Enumeration error.",
			error: 'Could not connect "Stream Deck Plus".',
			ok: false,
		});
		const logger = {
			warn: vi.fn(),
		};

		await runDeviceAction({
			action,
			createPlatformAdapter,
			executeAction,
			logger,
			operation: "connect",
			settings: {
				deviceName: "Stream Deck Plus",
			},
		});

		expect(action.showAlert).toHaveBeenCalledOnce();
		expect(action.showOk).not.toHaveBeenCalled();
		expect(action.setImage).toHaveBeenNthCalledWith(1, "imgs/states/active.svg");
		expect(action.setImage).toHaveBeenNthCalledWith(2, "imgs/states/error.svg");
		expect(logger.warn).toHaveBeenCalledWith(
			'USB Link connect failed: Could not connect "Stream Deck Plus". Detail: Underlying CLI returned: Error: Enumeration error.',
		);

		vi.advanceTimersByTime(1_200);
		await vi.runAllTimersAsync();

		expect(action.setImage).toHaveBeenNthCalledWith(3, undefined);
	});
});
