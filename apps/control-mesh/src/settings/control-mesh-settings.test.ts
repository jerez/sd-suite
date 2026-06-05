import { describe, expect, it } from "vitest";

import {
	createDefaultControlMeshSettings,
	mergeTrustedDiscoveredPeerEndpoints,
	normalizeControlMeshSettings,
	recordPeerConnectionResult,
	resetPeerConfirmation,
	upsertKnownPeer,
} from "./control-mesh-settings";

describe("control mesh settings", () => {
	it("creates a stable default shape for global settings", () => {
		const settings = createDefaultControlMeshSettings("node-a");

		expect(settings).toMatchObject({
			executor: {
				enabled: false,
				listenHost: "0.0.0.0",
				listenPort: 38765,
				localMcpUrl: "http://localhost:9090/mcp",
			},
			knownPeers: [],
			localNode: {
				nodeId: "node-a",
				nodeName: "Control Mesh",
			},
			trustLinks: [],
		});
	});

	it("preserves user-provided MCP URLs", () => {
		const settings = normalizeControlMeshSettings({
			executor: {
				localMcpUrl: "http://custom.local:9999/mcp",
			},
			localNode: {
				nodeId: "node-a",
			},
		});

		expect(settings.executor.localMcpUrl).toBe("http://custom.local:9999/mcp");
	});

	it("computes the advertised endpoint from local network host and listen port", () => {
		const settings = normalizeControlMeshSettings(
			{
				executor: {
					advertisedUrl: "http://localhost:38765",
					listenPort: 39000,
				},
				localNode: {
					nodeId: "node-a",
				},
			},
			{ advertisedHost: "studio.local" },
		);

		expect(settings.executor.advertisedUrl).toBe("http://studio.local:39000");
	});

	it("uses the advertised host as the default local node name", () => {
		const settings = normalizeControlMeshSettings(
			{
				localNode: {
					nodeId: "node-a",
				},
			},
			{ advertisedHost: "studio" },
		);

		expect(settings.localNode.nodeName).toBe("studio");
	});

	it("stores known peers with untested connection state", () => {
		const settings = createDefaultControlMeshSettings("node-a");
		const updated = upsertKnownPeer(settings, {
			displayName: "Studio",
			endpoints: ["http://studio.local:38765"],
			nodeId: "studio",
		});

		expect(updated.knownPeers[0]?.connection.state).toBe("untested");
	});

	it("resets confirmation when trust-sensitive peer data changes", () => {
		const settings = createDefaultControlMeshSettings("node-a");
		const updated = upsertKnownPeer(settings, {
			connection: {
				lastConfirmedAt: "2026-06-02T00:00:00.000Z",
				state: "confirmed",
			},
			displayName: "Studio",
			endpoints: ["http://studio.local:38765"],
			nodeId: "studio",
		});

		const reset = resetPeerConfirmation(updated, "studio", "Secret changed.");

		expect(reset.knownPeers[0]?.connection).toEqual({
			lastError: "Secret changed.",
			state: "untested",
		});
	});

	it("records a confirmed peer connection result", () => {
		const settings = upsertKnownPeer(createDefaultControlMeshSettings("node-a"), {
			displayName: "Studio",
			endpoints: ["http://studio.local:38765"],
			nodeId: "studio",
		});

		const updated = recordPeerConnectionResult(
			settings,
			{ nodeId: "studio", ok: true },
			new Date("2026-06-02T00:00:00.000Z"),
		);

		expect(updated.knownPeers[0]?.connection).toEqual({
			lastConfirmedAt: "2026-06-02T00:00:00.000Z",
			lastTestedAt: "2026-06-02T00:00:00.000Z",
			state: "confirmed",
		});
	});

	it("records a failed peer connection result", () => {
		const settings = upsertKnownPeer(createDefaultControlMeshSettings("node-a"), {
			displayName: "Studio",
			endpoints: ["http://studio.local:38765"],
			nodeId: "studio",
		});

		const updated = recordPeerConnectionResult(
			settings,
			{ error: "Peer API is not reachable.", nodeId: "studio", ok: false },
			new Date("2026-06-02T00:00:00.000Z"),
		);

		expect(updated.knownPeers[0]?.connection).toEqual({
			lastError: "Peer API is not reachable.",
			lastTestedAt: "2026-06-02T00:00:00.000Z",
			state: "failed",
		});
	});

	it("merges discovered executor endpoints into existing trusted peers", () => {
		const settings = upsertKnownPeer(createDefaultControlMeshSettings("node-a"), {
			displayName: "Desk",
			endpoints: [],
			nodeId: "desk",
		});

		const merged = mergeTrustedDiscoveredPeerEndpoints(settings, [
			{
				discoveredAt: "2026-06-02T00:00:00.000Z",
				endpoint: "http://desk.local:38765",
				executorEnabled: true,
				nodeId: "desk",
				nodeName: "Desk",
				version: "0.1.0",
			},
		]);

		expect(merged.knownPeers[0]).toEqual({
			connection: { state: "untested" },
			displayName: "Desk",
			endpoints: ["http://desk.local:38765"],
			nodeId: "desk",
		});
	});

	it("merges duplicate known-peer and trust-link entries by node id during normalization", () => {
		const settings = normalizeControlMeshSettings({
			knownPeers: [
				{
					connection: { state: "untested" },
					displayName: "Desk",
					endpoints: [],
					nodeId: "desk",
				},
				{
					connection: { lastConfirmedAt: "2026-06-02T00:00:00.000Z", state: "confirmed" },
					displayName: "Desk",
					endpoints: ["http://desk.local:38765"],
					nodeId: "desk",
				},
			],
			localNode: { nodeId: "node-a" },
			trustLinks: [
				{
					createdAt: "2026-06-02T00:00:00.000Z",
					enabled: true,
					remoteNodeId: "desk",
					secretVersion: 1,
					sharedSecret: "old-secret",
				},
				{
					createdAt: "2026-06-02T00:00:00.000Z",
					enabled: true,
					remoteNodeId: "desk",
					rotatedAt: "2026-06-02T01:00:00.000Z",
					secretVersion: 2,
					sharedSecret: "new-secret",
				},
			],
		});

		expect(settings.knownPeers).toEqual([
			{
				connection: {
					lastConfirmedAt: "2026-06-02T00:00:00.000Z",
					state: "confirmed",
				},
				displayName: "Desk",
				endpoints: ["http://desk.local:38765"],
				nodeId: "desk",
			},
		]);
		expect(settings.trustLinks).toEqual([
			{
				createdAt: "2026-06-02T00:00:00.000Z",
				enabled: true,
				remoteNodeId: "desk",
				rotatedAt: "2026-06-02T01:00:00.000Z",
				secretVersion: 2,
				sharedSecret: "new-secret",
			},
		]);
	});
});
