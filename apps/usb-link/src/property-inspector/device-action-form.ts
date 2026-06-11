import { parseDeviceActionSettings } from "../usbng/device-action-settings";

import type { StreamDeckClient } from "./stream-deck-client";

type ValueElement = HTMLElement & {
	value?: string;
};

/**
 * Validation result for the device-action property-inspector form.
 */
export type ValidationResult = { error: string; ok: false } | { ok: true };

/**
 * Editable form values managed by the shared device-action property inspector.
 */
export type DeviceActionFormInput = {
	deviceName?: string;
};

/**
 * Inputs required to wire the shared property-inspector form.
 */
export type InitializeDeviceActionPropertyInspectorInput = {
	client?: StreamDeckClient;
	document: Pick<Document, "body" | "getElementById">;
	helperText: string;
};

/**
 * Validates the current property-inspector form state.
 */
export function validateDeviceActionForm(input: DeviceActionFormInput): ValidationResult {
	const result = parseDeviceActionSettings(input);
	if (!result.ok) {
		return { error: result.error, ok: false };
	}

	return { ok: true };
}

/**
 * Initializes the shared property-inspector UI used by all four USB Link actions.
 */
export async function initializeDeviceActionPropertyInspector(
	input: InitializeDeviceActionPropertyInspectorInput,
): Promise<void> {
	const deviceNameField = input.document.getElementById("device-name") as ValueElement | null;
	const helperField = input.document.getElementById("device-helper") as ValueElement | null;
	const validationField = input.document.getElementById("validation-message") as ValueElement | null;

	if (helperField) {
		helperField.value = input.helperText;
	}

	if (deviceNameField && input.client) {
		const currentSettings = (await input.client.getSettings()) as DeviceActionFormInput;
		deviceNameField.value = typeof currentSettings.deviceName === "string" ? currentSettings.deviceName : "";
	}

	updateValidationMessage(validationField, { deviceName: readValue(deviceNameField) });

	if (deviceNameField) {
		deviceNameField.addEventListener("valuechange", () => {
			void persistDeviceName(input.client, deviceNameField, validationField);
		});
	}

	input.document.body.hidden = false;
}

async function persistDeviceName(
	client: StreamDeckClient | undefined,
	deviceNameField: ValueElement,
	validationField: ValueElement | null,
): Promise<void> {
	const settings = {
		deviceName: readValue(deviceNameField),
	};
	updateValidationMessage(validationField, settings);

	if (!client) {
		return;
	}

	const currentSettings = (await client.getSettings()) as Record<string, unknown>;
	// Preserve unrelated Stream Deck settings when updating the shared device-name field.
	await client.setSettings({
		...currentSettings,
		...settings,
	});
}

function updateValidationMessage(validationField: ValueElement | null, input: DeviceActionFormInput): void {
	if (!validationField) {
		return;
	}

	const result = validateDeviceActionForm(input);
	validationField.value = result.ok ? "" : result.error;
}

function readValue(element: ValueElement | null): string {
	return `${element?.value ?? ""}`;
}
