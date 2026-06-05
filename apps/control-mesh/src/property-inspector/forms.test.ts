import { describe, expect, it } from "vitest";

import { createDefaultControlMeshSettings, upsertKnownPeer, upsertTrustLink } from "../settings/control-mesh-settings";

import { removeKnownPeer, validateActionForm } from "./forms";

describe("property inspector form validation", () => {
	it("validates configured remote action settings", () => {
		expect(
			validateActionForm({
				actionId: "lights.on",
				targetNodeId: "studio",
			}),
		).toEqual({ ok: true });
	});

	it("rejects missing remote action", () => {
		expect(
			validateActionForm({
				targetNodeId: "studio",
			}),
		).toEqual({ error: "Remote action is required.", ok: false });
	});

	it("removes one known peer and its trust link without clearing other peers", () => {
		const base = createDefaultControlMeshSettings("local-node");
		const withPeers = upsertTrustLink(
			upsertKnownPeer(
				upsertKnownPeer(base, {
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				}),
				{
					displayName: "Lounge",
					endpoints: ["http://lounge.local:38765"],
					nodeId: "lounge",
				},
			),
			{ remoteNodeId: "studio", sharedSecret: "secret" },
			new Date("2026-06-02T00:00:00.000Z"),
		);

		const result = removeKnownPeer(withPeers, "studio");

		expect(result.knownPeers.map((peer) => peer.nodeId)).toEqual(["lounge"]);
		expect(result.trustLinks).toEqual([]);
	});
});
