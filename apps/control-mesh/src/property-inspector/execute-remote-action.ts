import { getStreamDeckClient } from "./stream-deck-client";

type RemoteActionsMessage = {
	actionDescriptions?: Record<string, string>;
	event?: string;
};

type SdpiSelectElement = HTMLElement & {
	options?: HTMLOptionsCollection;
	refresh?: () => void;
	selectedOptions?: HTMLCollectionOf<HTMLOptionElement>;
	value?: string;
};
type SdpiValueElement = HTMLElement & { value?: string };

if (typeof document !== "undefined") {
	document.addEventListener("DOMContentLoaded", () => {
		void initializeExecuteRemoteActionPropertyInspector({ client: getStreamDeckClient(), document });
	});
}

type ExecuteRemoteActionPropertyInspectorInit = {
	client: ReturnType<typeof getStreamDeckClient>;
	document: Pick<Document, "body" | "getElementById">;
};

export async function initializeExecuteRemoteActionPropertyInspector(
	input: ExecuteRemoteActionPropertyInspectorInit,
): Promise<void> {
	const targetPeerSelect = input.document.getElementById("target-peer-select") as SdpiSelectElement | null;
	const actionSelect = input.document.getElementById("remote-action-select") as SdpiSelectElement | null;
	const descriptionField = input.document.getElementById("remote-action-description") as SdpiValueElement | null;
	let actionDescriptions: Record<string, string> = {};

	input.document.body.hidden = false;

	if (input.client && actionSelect && descriptionField) {
		input.client.onPluginMessage((payload) => {
			if (!isRemoteActionsMessage(payload) || payload.event !== "getRemoteActions") {
				return;
			}

			actionDescriptions = payload.actionDescriptions ?? {};
			updateActionDescription(descriptionField, actionSelect, actionDescriptions);
		});
	}

	if (targetPeerSelect && actionSelect && descriptionField) {
		let currentTargetPeerId = await readInitialTargetPeerId(input.client, targetPeerSelect);
		targetPeerSelect.addEventListener("valuechange", () => {
			const nextTargetPeerId = readValue(targetPeerSelect);
			if (nextTargetPeerId === currentTargetPeerId) {
				return;
			}

			currentTargetPeerId = nextTargetPeerId;
			void resetActionSelection(input.client, targetPeerSelect, actionSelect, descriptionField);
		});
		actionSelect.addEventListener("valuechange", () => {
			updateActionDescription(descriptionField, actionSelect, actionDescriptions);
		});
		updateActionDescription(descriptionField, actionSelect, actionDescriptions);
	}
}

async function resetActionSelection(
	client: ReturnType<typeof getStreamDeckClient>,
	targetPeerSelect: SdpiSelectElement,
	actionSelect: SdpiSelectElement,
	descriptionField: SdpiValueElement,
): Promise<void> {
	actionSelect.value = "";
	descriptionField.value = "";

	if (!client) {
		actionSelect.refresh?.();
		return;
	}

	const currentSettings = (await client.getSettings()) as Record<string, unknown>;
	await client.setSettings({
		...currentSettings,
		actionId: "",
		actionLabel: "",
		targetNodeId: readValue(targetPeerSelect),
		targetNodeLabel: readSelectedLabel(targetPeerSelect),
	});
	actionSelect.refresh?.();
}

function readSelectedLabel(select: SdpiSelectElement): string {
	const label = select.selectedOptions?.[0]?.textContent?.trim();
	return label ?? "";
}

function updateActionDescription(
	descriptionField: SdpiValueElement,
	actionSelect: SdpiSelectElement,
	actionDescriptions: Record<string, string>,
): void {
	descriptionField.value = actionDescriptions[readValue(actionSelect)] ?? "";
}

function isRemoteActionsMessage(payload: unknown): payload is RemoteActionsMessage {
	return Boolean(payload && typeof payload === "object");
}

async function readInitialTargetPeerId(
	client: ReturnType<typeof getStreamDeckClient>,
	targetPeerSelect: SdpiSelectElement,
): Promise<string> {
	if (!client) {
		return readValue(targetPeerSelect);
	}

	const currentSettings = (await client.getSettings()) as Record<string, unknown>;
	const targetNodeId = typeof currentSettings.targetNodeId === "string" ? currentSettings.targetNodeId : "";

	return targetNodeId.trim() || readValue(targetPeerSelect);
}

function readValue(element: SdpiValueElement): string {
	return `${element.value ?? ""}`.trim();
}
