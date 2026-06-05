import { describe, expect, it, vi } from "vitest";

import {
	bindValueChange,
	getAcceptedPeerNodeId,
	isTrustedPeerActionAllowed,
	renderExecutorState,
} from "./control-mesh-setup";

function createElement(tagName: string): HTMLElement {
	const element = new EventTarget() as HTMLElement;
	const attributes = new Set<string>();
	Object.defineProperty(element, "tagName", { value: tagName });
	element.hasAttribute = (name: string) => attributes.has(name);
	element.toggleAttribute = (name: string, force?: boolean) => {
		const enabled = force ?? !attributes.has(name);
		if (enabled) {
			attributes.add(name);
			return true;
		}

		attributes.delete(name);
		return false;
	};

	return element;
}

describe("bindValueChange", () => {
	it("waits for SDPI valuechange events so component values are current", () => {
		const element = createElement("SDPI-CHECKBOX");
		const handler = vi.fn();

		bindValueChange(element, handler);
		element.dispatchEvent(new Event("input"));
		element.dispatchEvent(new Event("valuechange"));

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("keeps native input and change support for non-SDPI elements", () => {
		const element = createElement("INPUT");
		const handler = vi.fn();

		bindValueChange(element, handler);
		element.dispatchEvent(new Event("input"));
		element.dispatchEvent(new Event("change"));

		expect(handler).toHaveBeenCalledTimes(2);
	});
});

describe("renderExecutorState", () => {
	it("shows executor fields immediately when exposure is enabled", () => {
		const listenPort = createElement("SDPI-TEXTFIELD");
		const executorSettings = [createElement("SDPI-ITEM"), createElement("SDPI-ITEM")];
		const executorResults = [createElement("SDPI-ITEM")];
		for (const element of [...executorSettings, ...executorResults]) {
			element.hidden = true;
		}

		renderExecutorState({ executorResults, executorSettings, listenPort }, true);

		expect(listenPort.hasAttribute("disabled")).toBe(false);
		expect(executorSettings.map((element) => element.hidden)).toEqual([false, false]);
		expect(executorResults.map((element) => element.hidden)).toEqual([true]);
	});

	it("hides executor fields and result rows when exposure is disabled", () => {
		const listenPort = createElement("SDPI-TEXTFIELD");
		const executorSettings = [createElement("SDPI-ITEM"), createElement("SDPI-ITEM")];
		const executorResults = [createElement("SDPI-ITEM")];

		renderExecutorState({ executorResults, executorSettings, listenPort }, false);

		expect(listenPort.hasAttribute("disabled")).toBe(true);
		expect(executorSettings.map((element) => element.hidden)).toEqual([true, true]);
		expect(executorResults.map((element) => element.hidden)).toEqual([true]);
	});
});

describe("isTrustedPeerActionAllowed", () => {
	it("allows authenticated peer actions for a trusted peer", () => {
		expect(
			isTrustedPeerActionAllowed({
				hasClient: true,
				hasEndpoint: true,
				hasPeer: true,
				hasTrustLink: true,
			}),
		).toBe(true);
	});

	it("requires the Stream Deck client, a selected peer, and a stored trust link", () => {
		const completeInput = {
			hasClient: true,
			hasEndpoint: true,
			hasPeer: true,
			hasTrustLink: true,
		};

		expect(isTrustedPeerActionAllowed({ ...completeInput, hasClient: false })).toBe(false);
		expect(isTrustedPeerActionAllowed({ ...completeInput, hasEndpoint: false })).toBe(false);
		expect(isTrustedPeerActionAllowed({ ...completeInput, hasPeer: false })).toBe(false);
		expect(isTrustedPeerActionAllowed({ ...completeInput, hasTrustLink: false })).toBe(false);
	});
});

describe("getAcceptedPeerNodeId", () => {
	it("returns the accepted peer id from a persisted pairing notification", () => {
		expect(getAcceptedPeerNodeId({ ok: true, remoteNodeId: "node-a", type: "pairingAccepted" })).toBe("node-a");
	});

	it("ignores pairing acknowledgements that do not prove persistence", () => {
		expect(getAcceptedPeerNodeId({ ok: true, type: "pairingDecisionResult" })).toBeUndefined();
		expect(getAcceptedPeerNodeId({ remoteNodeId: "node-a", type: "unknown" })).toBeUndefined();
	});
});
