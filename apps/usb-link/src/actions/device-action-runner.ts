import streamDeck from "@elgato/streamdeck";

import {
	type DeviceActionExecutionResult,
	executeDeviceAction,
	filterRemoteDevicesForOperation,
} from "../usbng/device-action-core";
import { createUsbngPlatformAdapter } from "../usbng/platform";
import type { UsbngPlatformAdapter } from "../usbng/platform-adapter";
import type { DeviceActionSettings, DeviceOperation } from "../usbng/device-types";

const ACTIVE_IMAGE_PATH = "imgs/states/active.svg";
const ERROR_IMAGE_PATH = "imgs/states/error.svg";
const SUCCESS_IMAGE_PATH = "imgs/states/success.svg";
const RESULT_IMAGE_DWELL_MS = 1_200;

type ActionImageHandle = {
	setImage(image?: string): Promise<void>;
	showAlert(): Promise<void>;
	showOk(): Promise<void>;
};

type FeedbackImageController = {
	showActive(action: ActionImageHandle): Promise<void>;
	showError(action: ActionImageHandle): Promise<void>;
	showSuccess(action: ActionImageHandle): Promise<void>;
};

type ActionLogger = {
	warn(message: string): void;
};

export type DeviceOptionsMessage = { event: "getUsbDevices"; isRefresh?: true };

type DeviceOptionsResult = {
	event: "getUsbDevices";
	items: { disabled?: boolean; label: string; value: string }[];
};

/**
 * Inputs required to execute one Stream Deck USB Link action press.
 */
export type RunDeviceActionInput = {
	action: ActionImageHandle;
	createFeedbackImageController?: () => FeedbackImageController;
	createPlatformAdapter?: () => UsbngPlatformAdapter;
	executeAction?: (input: {
		adapter: UsbngPlatformAdapter;
		operation: DeviceOperation;
		settings: DeviceActionSettings;
	}) => Promise<DeviceActionExecutionResult>;
	logger?: ActionLogger;
	operation: DeviceOperation;
	settings: DeviceActionSettings;
};

/**
 * Runs a USB Link action end to end, including device execution, logging, and
 * transient key-image feedback.
 */
export async function runDeviceAction(input: RunDeviceActionInput): Promise<void> {
	const createFeedbackImages = input.createFeedbackImageController ?? createFeedbackImageController;
	const createPlatformAdapter = input.createPlatformAdapter ?? createUsbngPlatformAdapter;
	const executeAction = input.executeAction ?? executeDeviceAction;
	const logger = input.logger ?? streamDeck.logger;
	const feedbackImages = createFeedbackImages();

	await feedbackImages.showActive(input.action);

	try {
		const result = await executeAction({
			adapter: createPlatformAdapter(),
			operation: input.operation,
			settings: input.settings,
		});

		if (!result.ok) {
			logger.warn(formatFailureLogMessage(input.operation, result));
			await feedbackImages.showError(input.action);
			await input.action.showAlert();
			return;
		}

		await feedbackImages.showSuccess(input.action);
		await input.action.showOk();
	} catch (error) {
		logger.warn(`USB Link ${input.operation} failed: ${getErrorMessage(error)}`);
		await feedbackImages.showError(input.action);
		await input.action.showAlert();
	}
}

/**
 * Lists valid devices for one action's property-inspector selector.
 */
export async function getDeviceOptions(
	operation: DeviceOperation,
	createPlatformAdapter: () => UsbngPlatformAdapter = createUsbngPlatformAdapter,
	remoteServer?: string,
): Promise<DeviceOptionsResult> {
	try {
		const adapter = createPlatformAdapter();
		const devices =
			operation === "share"
				? await adapter.listLocalDevices()
				: operation === "unshare"
					? await adapter.listSharedDevices()
					: filterRemoteDevicesForOperation(
							await adapter.listRemoteDevices(remoteServer?.trim() || undefined),
							operation,
						);
		const items = devices
			.map((device) => ({ label: device.name, value: device.id }))
			.sort((left, right) => left.label.localeCompare(right.label));

		return {
			event: "getUsbDevices",
			items: items.length > 0 ? items : [{ disabled: true, label: "No matching USB devices found.", value: "" }],
		};
	} catch (error) {
		return {
			event: "getUsbDevices",
			items: [{ disabled: true, label: `Devices unavailable: ${getErrorMessage(error)}`, value: "" }],
		};
	}
}

/**
 * Responds to the SDPI datasource request for one USB Link action.
 */
export async function sendDeviceOptions(
	message: DeviceOptionsMessage,
	operation: DeviceOperation,
	remoteServer?: string,
): Promise<void> {
	if (message.event === "getUsbDevices") {
		await streamDeck.ui.sendToPropertyInspector(
			await getDeviceOptions(operation, createUsbngPlatformAdapter, remoteServer),
		);
	}
}

function formatFailureLogMessage(
	operation: DeviceOperation,
	result: Extract<DeviceActionExecutionResult, { ok: false }>,
): string {
	if (result.detail) {
		return `USB Link ${operation} failed: ${result.error} Detail: ${result.detail}`;
	}

	return `USB Link ${operation} failed: ${result.error}`;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function createFeedbackImageController(): FeedbackImageController {
	const restoreTimers = new WeakMap<ActionImageHandle, ReturnType<typeof setTimeout>>();

	return {
		async showActive(action) {
			clearRestore(action);
			await action.setImage(ACTIVE_IMAGE_PATH);
		},
		async showError(action) {
			await showResult(action, ERROR_IMAGE_PATH);
		},
		async showSuccess(action) {
			await showResult(action, SUCCESS_IMAGE_PATH);
		},
	};

	async function showResult(action: ActionImageHandle, imagePath: string): Promise<void> {
		clearRestore(action);
		await action.setImage(imagePath);
		restoreTimers.set(
			action,
			setTimeout(() => {
				// Revert to the action's default key image after the success/error dwell window.
				restoreTimers.delete(action);
				// Swallow rejections: the action context may be gone by the time the dwell timer fires.
				void action.setImage(undefined).catch(() => undefined);
			}, RESULT_IMAGE_DWELL_MS),
		);
	}

	function clearRestore(action: ActionImageHandle): void {
		const timer = restoreTimers.get(action);
		if (!timer) {
			return;
		}

		clearTimeout(timer);
		restoreTimers.delete(action);
	}
}
