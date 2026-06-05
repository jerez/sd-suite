import { describe, expect, it } from "vitest";

import { parseExecuteRemoteActionSettings } from "./execute-remote-action-settings";

describe("parseExecuteRemoteActionSettings", () => {
	it("accepts configured remote action settings", () => {
		const result = parseExecuteRemoteActionSettings({
			actionId: "streamdeck.action",
			targetNodeId: "peer-a",
		});

		expect(result).toEqual({
			ok: true,
			value: {
				actionId: "streamdeck.action",
				targetNodeId: "peer-a",
			},
		});
	});

	it("rejects missing target node", () => {
		const result = parseExecuteRemoteActionSettings({
			actionId: "streamdeck.action",
		});

		expect(result).toEqual({ error: "Target peer is required.", ok: false });
	});

	it("rejects missing action id", () => {
		const result = parseExecuteRemoteActionSettings({
			targetNodeId: "peer-a",
		});

		expect(result).toEqual({ error: "Remote action is required.", ok: false });
	});
});
