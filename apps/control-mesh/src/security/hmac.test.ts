import { describe, expect, it } from "vitest";

import { createNonceCache, signPeerRequest, verifyPeerRequest } from "./hmac";

describe("hmac peer authentication", () => {
	it("verifies a signed request", async () => {
		const signed = await signPeerRequest({
			body: '{"ok":true}',
			method: "POST",
			nonce: "nonce-a",
			path: "/actions/test/execute",
			secret: "shared-secret",
			senderNodeId: "node-a",
			timestamp: "2026-06-02T00:00:00.000Z",
		});

		const result = await verifyPeerRequest({
			body: '{"ok":true}',
			headers: signed.headers,
			method: "POST",
			nonceCache: createNonceCache(),
			now: new Date("2026-06-02T00:00:30.000Z"),
			path: "/actions/test/execute",
			resolveSecret: (nodeId) => (nodeId === "node-a" ? "shared-secret" : undefined),
		});

		expect(result).toEqual({ ok: true, senderNodeId: "node-a" });
	});

	it("rejects replayed nonces", async () => {
		const nonceCache = createNonceCache();
		const signed = await signPeerRequest({
			body: "",
			method: "GET",
			nonce: "nonce-a",
			path: "/health",
			secret: "shared-secret",
			senderNodeId: "node-a",
			timestamp: "2026-06-02T00:00:00.000Z",
		});

		const first = await verifyPeerRequest({
			body: "",
			headers: signed.headers,
			method: "GET",
			nonceCache,
			now: new Date("2026-06-02T00:00:10.000Z"),
			path: "/health",
			resolveSecret: () => "shared-secret",
		});
		const second = await verifyPeerRequest({
			body: "",
			headers: signed.headers,
			method: "GET",
			nonceCache,
			now: new Date("2026-06-02T00:00:20.000Z"),
			path: "/health",
			resolveSecret: () => "shared-secret",
		});

		expect(first.ok).toBe(true);
		expect(second).toEqual({ error: "Nonce has already been used.", ok: false });
	});
});
