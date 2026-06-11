import { parseDeviceActionSettings } from "../usbng/device-action-settings";

import type { StreamDeckClient } from "./stream-deck-client";

type ValueElement = HTMLElement & {
	value?: string;
};

export type ValidationResult = { error: string; ok: false } | { ok: true };

export type DeviceActionFormInput = {
	deviceName?: string;
};

export type InitializeDeviceActionPropertyInspectorInput = {
	client?: StreamDeckClient;
	document: Pick<Document, "body" | "getElementById">;
	helperText: string;
};

export function validateDeviceActionForm(input: DeviceActionFormInput): ValidationResult {
	const result = parseDeviceActionSettings(input);
	if (!result.ok) {
		return { error: result.error, ok: false };
	}

	return { ok: true };
}

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
