import { describe, expect, it, vi } from "vitest";

import { initializeExecuteRemoteActionPropertyInspector } from "./execute-remote-action";
import type { StreamDeckClient } from "./stream-deck-client";

type SelectElement = HTMLElement & {
	refresh?: () => void;
	selectedOptions?: Array<{ textContent?: string | null }>;
	value?: string;
};

type ValueElement = HTMLElement & {
	value?: string;
};

function createValueElement(): ValueElement {
	const element = new EventTarget() as ValueElement;
	element.value = "";
	return element;
}

function createSelectElement(optionLabels: Record<string, string> = {}): SelectElement {
	const element = createValueElement() as SelectElement;
	const refresh = vi.fn();

	element.refresh = refresh;
	Object.defineProperty(element, "selectedOptions", {
		get() {
			const label = optionLabels[element.value ?? ""];
			return label ? [{ textContent: label }] : [];
		},
	});

	return element;
}

function createDocument(
	elements: Record<string, HTMLElement>,
): Pick<Document, "body" | "getElementById"> & { body: { hidden: boolean } } {
	return {
		body: { hidden: true } as Document["body"] & { hidden: boolean },
		getElementById(id: string) {
			return elements[id] ?? null;
		},
	};
}

function createClient(settings: Record<string, unknown>): StreamDeckClient {
	return {
		getGlobalSettings: vi.fn(async () => ({})),
		getSettings: vi.fn(async () => settings),
		onPluginMessage: vi.fn(() => () => undefined),
		sendToPlugin: vi.fn(async () => undefined),
		setGlobalSettings: vi.fn(async () => undefined),
		setSettings: vi.fn(async () => undefined),
	};
}

describe("initializeExecuteRemoteActionPropertyInspector", () => {
	it("does not clear the saved action when SDPI hydrates the persisted peer value", async () => {
		const targetPeerSelect = createSelectElement({ overseer: "Overseer" });
		const actionSelect = createSelectElement({ actionA: "Overseer: Juanna Ink" });
		const descriptionField = createValueElement();
		const client = createClient({
			actionId: "actionA",
			actionLabel: "Overseer: Juanna Ink",
			targetNodeId: "overseer",
			targetNodeLabel: "Overseer",
		});

		await initializeExecuteRemoteActionPropertyInspector({
			client,
			document: createDocument({
				"remote-action-description": descriptionField,
				"remote-action-select": actionSelect,
				"target-peer-select": targetPeerSelect,
			}),
		});

		targetPeerSelect.value = "overseer";
		targetPeerSelect.dispatchEvent(new Event("valuechange"));

		expect(client.setSettings).not.toHaveBeenCalled();
		expect(actionSelect.refresh).not.toHaveBeenCalled();
	});

	it("clears the selected action when the user changes to a different peer", async () => {
		const targetPeerSelect = createSelectElement({
			overseer: "Overseer",
			studio: "Studio",
		});
		const actionSelect = createSelectElement({ actionA: "Overseer: Juanna Ink" });
		const descriptionField = createValueElement();
		const client = createClient({
			actionId: "actionA",
			actionLabel: "Overseer: Juanna Ink",
			targetNodeId: "overseer",
			targetNodeLabel: "Overseer",
		});

		actionSelect.value = "actionA";
		descriptionField.value = "Overseer: Website action";

		await initializeExecuteRemoteActionPropertyInspector({
			client,
			document: createDocument({
				"remote-action-description": descriptionField,
				"remote-action-select": actionSelect,
				"target-peer-select": targetPeerSelect,
			}),
		});

		targetPeerSelect.value = "studio";
		targetPeerSelect.dispatchEvent(new Event("valuechange"));
		await vi.waitFor(() =>
			expect(client.setSettings).toHaveBeenCalledWith({
				actionId: "",
				actionLabel: "",
				targetNodeId: "studio",
				targetNodeLabel: "Studio",
			}),
		);

		expect(actionSelect.value).toBe("");
		expect(descriptionField.value).toBe("");
	});
});
