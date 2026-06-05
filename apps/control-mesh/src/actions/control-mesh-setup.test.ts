import { describe, expect, it, vi } from "vitest";

import { createDefaultControlMeshSettings } from "../settings/control-mesh-settings";

import { ControlMeshSetup, handleSetupPropertyInspectorMessage } from "./control-mesh-setup";

describe("handleSetupPropertyInspectorMessage", () => {
	const baseDependencies = {
		approvePairingRequest: vi.fn(),
		createPairingClient: vi.fn(),
		createPeerClient: vi.fn(),
		refreshDiscovery: async () => ({ discoveredPeers: [], ok: true }),
		rejectPairingRequest: vi.fn(),
		setSettings: vi.fn(),
	};

	it("tests the configured local MCP endpoint", async () => {
		const settings = createDefaultControlMeshSettings("local-node");
		const listActions = vi.fn(async () => [{ id: "runtime-action-id", name: "runtime-action-id", title: "Lights On" }]);
		const createMcpClient = vi.fn(() => ({ listActions }));

		const result = await handleSetupPropertyInspectorMessage(
			{ type: "testLocalMcp" },
			{
				...baseDependencies,
				createMcpClient,
				getSettings: () => settings,
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(createMcpClient).toHaveBeenCalledWith({ timeoutMs: 3000, url: settings.executor.localMcpUrl });
		expect(result).toEqual({
			actionCount: 1,
			ok: true,
			type: "testLocalMcpResult",
			url: settings.executor.localMcpUrl,
		});
	});

	it("does not set a key title for the setup action", async () => {
		const action = new ControlMeshSetup({
			runtime: {
				refreshDiscovery: vi.fn(),
				resolvePeerConnection: vi.fn(),
			},
		});
		const setTitle = vi.fn();

		await action.onWillAppear();

		expect(setTitle).not.toHaveBeenCalled();
	});

	it("tests the local MCP endpoint visible in the property inspector", async () => {
		const visibleLocalMcpUrl = "http://localhost:9999/mcp";
		const listActions = vi.fn(async () => [{ id: "runtime-action-id", name: "runtime-action-id", title: "Lights On" }]);
		const createMcpClient = vi.fn(() => ({ listActions }));

		const result = await handleSetupPropertyInspectorMessage(
			{ localMcpUrl: visibleLocalMcpUrl, type: "testLocalMcp" },
			{
				...baseDependencies,
				createMcpClient,
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(createMcpClient).toHaveBeenCalledWith({ timeoutMs: 3000, url: visibleLocalMcpUrl });
		expect(result).toMatchObject({ ok: true, type: "testLocalMcpResult", url: visibleLocalMcpUrl });
	});

	it("returns a structured local MCP test error", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ type: "testLocalMcp" },
			{
				...baseDependencies,
				createMcpClient: () => ({
					listActions: vi.fn(async () => {
						throw new Error("MCP offline");
					}),
				}),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			error: "MCP offline",
			ok: false,
			type: "testLocalMcpResult",
			url: createDefaultControlMeshSettings("local-node").executor.localMcpUrl,
		});
	});

	it("returns discovered peers on successful discovery refresh", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ type: "refreshDiscovery" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				refreshDiscovery: async () => ({
					discoveredPeers: [
						{
							discoveredAt: "2026-06-02T00:00:00.000Z",
							endpoint: "http://studio.local:38765",
							executorEnabled: true,
							nodeId: "studio",
							nodeName: "Studio",
							version: "0.1.0",
						},
					],
					ok: true,
				}),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			discoveredPeers: [
				{
					discoveredAt: "2026-06-02T00:00:00.000Z",
					endpoint: "http://studio.local:38765",
					executorEnabled: true,
					nodeId: "studio",
					nodeName: "Studio",
					version: "0.1.0",
				},
			],
			ok: true,
			type: "refreshDiscoveryResult",
		});
	});

	it("updates a trusted peer endpoint when discovery later finds that peer exposing actions", async () => {
		const settings = {
			...createDefaultControlMeshSettings("local-node"),
			knownPeers: [
				{
					connection: { state: "untested" as const },
					displayName: "Studio",
					endpoints: [],
					nodeId: "studio",
				},
			],
		};
		const setSettings = vi.fn();

		await handleSetupPropertyInspectorMessage(
			{ type: "refreshDiscovery" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => settings,
				refreshDiscovery: async () => ({
					discoveredPeers: [
						{
							discoveredAt: "2026-06-02T00:00:00.000Z",
							endpoint: "http://studio.local:38765",
							executorEnabled: true,
							nodeId: "studio",
							nodeName: "Studio",
							version: "0.1.0",
						},
					],
					ok: true,
				}),
				resolvePeerConnection: vi.fn(),
				setSettings,
			},
		);

		expect(setSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				knownPeers: [
					{
						connection: { state: "untested" },
						displayName: "Studio",
						endpoints: ["http://studio.local:38765"],
						nodeId: "studio",
					},
				],
			}),
		);
	});

	it("requests pairing from a discovered peer and stores the returned trust link", async () => {
		const settings = {
			...createDefaultControlMeshSettings("local-node"),
			executor: {
				...createDefaultControlMeshSettings("local-node").executor,
				advertisedUrl: "http://desk.local:38765",
			},
			localNode: { nodeId: "local-node", nodeName: "Desk" },
		};
		const requestPairing = vi.fn(async () => ({
			endpoint: "http://studio.local:38765",
			node: { nodeId: "studio", nodeName: "Studio" },
			ok: true as const,
			sharedSecret: "generated-secret",
		}));
		const setSettings = vi.fn();

		const result = await handleSetupPropertyInspectorMessage(
			{
				peerEndpoint: "http://studio.local:38765",
				remoteNodeId: "studio",
				type: "requestPairing",
			},
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				createPairingClient: vi.fn(() => ({ requestPairing })),
				getSettings: () => settings,
				resolvePeerConnection: vi.fn(),
				setSettings,
			},
		);

		expect(requestPairing).toHaveBeenCalledWith({
			endpoint: "http://desk.local:38765",
			executorEnabled: false,
			node: { nodeId: "local-node", nodeName: "Desk" },
		});
		expect(setSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				knownPeers: [
					{
						connection: { state: "untested" },
						displayName: "Studio",
						endpoints: ["http://studio.local:38765"],
						nodeId: "studio",
					},
				],
				trustLinks: [
					expect.objectContaining({
						remoteNodeId: "studio",
						sharedSecret: "generated-secret",
					}),
				],
			}),
		);
		expect(result).toEqual({
			ok: true,
			remoteNodeId: "studio",
			type: "requestPairingResult",
		});
	});

	it("routes pairing approval decisions to the live approval broker", async () => {
		const approvePairingRequest = vi.fn();
		const rejectPairingRequest = vi.fn();

		const approved = await handleSetupPropertyInspectorMessage(
			{ requestId: "pair-1", type: "approvePairingRequest" },
			{
				...baseDependencies,
				approvePairingRequest,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				rejectPairingRequest,
				resolvePeerConnection: vi.fn(),
			},
		);
		const rejected = await handleSetupPropertyInspectorMessage(
			{ requestId: "pair-2", type: "rejectPairingRequest" },
			{
				...baseDependencies,
				approvePairingRequest,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				rejectPairingRequest,
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(approvePairingRequest).toHaveBeenCalledWith("pair-1");
		expect(rejectPairingRequest).toHaveBeenCalledWith("pair-2");
		expect(approved).toEqual({ ok: true, type: "pairingDecisionResult" });
		expect(rejected).toEqual({ ok: true, type: "pairingDecisionResult" });
	});

	it("validates that the requested executor port is available", async () => {
		const isPortAvailable = vi.fn(async () => true);

		const result = await handleSetupPropertyInspectorMessage(
			{ executorEnabled: true, listenPort: 39000, type: "validateNetworkSettings" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				isPortAvailable,
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(isPortAvailable).toHaveBeenCalledWith("0.0.0.0", 39000);
		expect(result).toEqual({
			listenPort: 39000,
			ok: true,
			type: "validateNetworkSettingsResult",
		});
	});

	it("rejects executor network settings when the requested port is unavailable", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ executorEnabled: true, listenPort: 39000, type: "validateNetworkSettings" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				isPortAvailable: vi.fn(async () => false),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			error: "Port 39000 is already in use.",
			listenPort: 39000,
			ok: false,
			type: "validateNetworkSettingsResult",
		});
	});

	it("does not validate port availability when executor exposure is disabled", async () => {
		const isPortAvailable = vi.fn(async () => false);

		const result = await handleSetupPropertyInspectorMessage(
			{ executorEnabled: false, listenPort: 39000, type: "validateNetworkSettings" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				isPortAvailable,
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(isPortAvailable).not.toHaveBeenCalled();
		expect(result).toEqual({
			listenPort: 39000,
			ok: true,
			type: "validateNetworkSettingsResult",
		});
	});

	it("returns a discovery error when discovery is disabled", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ type: "refreshDiscovery" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				refreshDiscovery: async () => ({ discoveredPeers: [], error: "Discovery is disabled.", ok: false }),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			error: "Discovery is disabled.",
			ok: false,
			type: "refreshDiscoveryResult",
		});
	});

	it("returns a descriptive local MCP offline message", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ localMcpUrl: "http://localhost:9090/mcp", type: "testLocalMcp" },
			{
				...baseDependencies,
				createMcpClient: () => ({
					listActions: vi.fn(async () => {
						throw new TypeError("fetch failed");
					}),
				}),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			error: "MCP is not running at localhost:9090. Start the Elgato MCP server or update the Local MCP URL.",
			ok: false,
			type: "testLocalMcpResult",
			url: "http://localhost:9090/mcp",
		});
	});

	it("returns a descriptive local MCP timeout message", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ localMcpUrl: "http://localhost:9090/mcp", type: "testLocalMcp" },
			{
				...baseDependencies,
				createMcpClient: () => ({
					listActions: vi.fn(async () => {
						const error = new Error("The operation timed out.");
						error.name = "TimeoutError";
						throw error;
					}),
				}),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			error: "MCP did not respond at localhost:9090 within 3 seconds.",
			ok: false,
			type: "testLocalMcpResult",
			url: "http://localhost:9090/mcp",
		});
	});

	it("tests a configured trusted peer", async () => {
		const settings = {
			...createDefaultControlMeshSettings("local-node"),
			knownPeers: [
				{
					connection: { state: "untested" as const },
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				},
			],
		};
		const health = vi.fn(async () => ({
			executor: { enabled: true, mcpHealthy: true },
			node: { nodeId: "studio", nodeName: "Studio" },
			version: "0.1.0",
		}));
		const createPeerClient = vi.fn(() => ({ health, rotateSecret: vi.fn() }));
		const setSettings = vi.fn();

		const result = await handleSetupPropertyInspectorMessage(
			{ remoteNodeId: "studio", type: "testPeerConnection" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				createPeerClient: createPeerClient,
				getSettings: () => settings,
				async resolvePeerConnection() {
					return {
						localNodeId: "local-node",
						secret: "shared-secret",
						url: "http://studio.local:38765",
					};
				},
				setSettings,
			},
		);

		expect(createPeerClient).toHaveBeenCalledWith({
			localNodeId: "local-node",
			secret: "shared-secret",
			url: "http://studio.local:38765",
		});
		expect(setSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				knownPeers: [
					expect.objectContaining({
						connection: expect.objectContaining({
							lastConfirmedAt: expect.any(String),
							lastTestedAt: expect.any(String),
							state: "confirmed",
						}),
						nodeId: "studio",
					}),
				],
			}),
		);
		expect(result).toEqual({ ok: true, remoteNodeId: "studio", type: "testPeerConnectionResult" });
	});

	it("rejects peer tests when the peer responds with a different node id", async () => {
		const settings = {
			...createDefaultControlMeshSettings("local-node"),
			knownPeers: [
				{
					connection: { state: "untested" as const },
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				},
			],
		};
		const health = vi.fn(async () => ({
			executor: { enabled: true, mcpHealthy: true },
			node: { nodeId: "other-node", nodeName: "Other" },
			version: "0.1.0",
		}));
		const setSettings = vi.fn();

		const result = await handleSetupPropertyInspectorMessage(
			{ remoteNodeId: "studio", type: "testPeerConnection" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				createPeerClient: vi.fn(() => ({ health, rotateSecret: vi.fn() })),
				getSettings: () => settings,
				async resolvePeerConnection() {
					return {
						localNodeId: "local-node",
						secret: "shared-secret",
						url: "http://studio.local:38765",
					};
				},
				setSettings,
			},
		);

		expect(setSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				knownPeers: [
					expect.objectContaining({
						connection: expect.objectContaining({
							lastError: expect.stringContaining("other-node"),
							lastTestedAt: expect.any(String),
							state: "failed",
						}),
						nodeId: "studio",
					}),
				],
			}),
		);
		expect(result).toEqual({
			error: "Peer responded as other-node instead of studio.",
			ok: false,
			remoteNodeId: "studio",
			type: "testPeerConnectionResult",
		});
	});

	it("rotates a configured trusted peer secret on both peers", async () => {
		const settings = {
			...createDefaultControlMeshSettings("local-node"),
			knownPeers: [
				{
					connection: { state: "confirmed" as const },
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				},
			],
			trustLinks: [
				{
					createdAt: "2026-06-02T00:00:00.000Z",
					enabled: true,
					remoteNodeId: "studio",
					secretVersion: 1,
					sharedSecret: "old-secret",
				},
			],
		};
		const rotateSecret = vi.fn(async (sharedSecret: string) => {
			expect(sharedSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
			return { ok: true as const };
		});
		const setSettings = vi.fn();

		const result = await handleSetupPropertyInspectorMessage(
			{ remoteNodeId: "studio", type: "rotatePeerSecret" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				createPeerClient: vi.fn(() => ({ health: vi.fn(), rotateSecret })),
				getSettings: () => settings,
				resolvePeerConnection: vi.fn(async () => ({
					localNodeId: "local-node",
					secret: "old-secret",
					url: "http://studio.local:38765",
				})),
				setSettings,
			},
		);

		expect(rotateSecret).toHaveBeenCalledWith(expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
		const newSecret = rotateSecret.mock.calls[0]?.[0] as string;
		expect(setSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				trustLinks: [
					expect.objectContaining({
						remoteNodeId: "studio",
						secretVersion: 2,
						sharedSecret: newSecret,
					}),
				],
			}),
		);
		expect(result).toEqual({ ok: true, remoteNodeId: "studio", type: "rotatePeerSecretResult" });
	});

	it("returns a descriptive peer connection error when API endpoint is unreachable", async () => {
		const settings = {
			...createDefaultControlMeshSettings("local-node"),
			knownPeers: [
				{
					connection: { state: "untested" as const },
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				},
			],
		};
		const createPeerClient = vi.fn(() => ({
			health: vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
			rotateSecret: vi.fn(),
		}));
		const setSettings = vi.fn();

		const result = await handleSetupPropertyInspectorMessage(
			{ remoteNodeId: "studio", type: "testPeerConnection" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				createPeerClient,
				getSettings: () => settings,
				async resolvePeerConnection() {
					return {
						localNodeId: "local-node",
						secret: "shared-secret",
						url: "http://studio.local:38765",
					};
				},
				setSettings,
			},
		);

		expect(createPeerClient).toHaveBeenCalledWith({
			localNodeId: "local-node",
			secret: "shared-secret",
			url: "http://studio.local:38765",
		});
		expect(setSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				knownPeers: [
					expect.objectContaining({
						connection: expect.objectContaining({
							lastError:
								"Peer API is not reachable at studio.local:38765. Verify the peer is running and reachable from this machine.",
							lastTestedAt: expect.any(String),
							state: "failed",
						}),
						nodeId: "studio",
					}),
				],
			}),
		);
		expect(result).toEqual({
			error:
				"Peer API is not reachable at studio.local:38765. Verify the peer is running and reachable from this machine.",
			ok: false,
			remoteNodeId: "studio",
			type: "testPeerConnectionResult",
		});
	});

	it("warns when a peer endpoint still points at /mcp", async () => {
		const createPeerClient = vi.fn(() => ({
			health: vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
			rotateSecret: vi.fn(),
		}));

		const result = await handleSetupPropertyInspectorMessage(
			{ remoteNodeId: "studio", type: "testPeerConnection" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				createPeerClient,
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				async resolvePeerConnection() {
					return {
						localNodeId: "local-node",
						secret: "shared-secret",
						url: "http://studio.local:38765/mcp",
					};
				},
			},
		);

		expect(result).toEqual({
			error:
				"Peer API is not reachable at studio.local:38765. Ensure this is the peer API base URL (for example http://host:38765), not an Elgato MCP /mcp endpoint. Verify the peer is running and reachable from this machine.",
			ok: false,
			remoteNodeId: "studio",
			type: "testPeerConnectionResult",
		});
	});

	it("rejects peer tests without a configured connection", async () => {
		const result = await handleSetupPropertyInspectorMessage(
			{ remoteNodeId: "studio", type: "testPeerConnection" },
			{
				...baseDependencies,
				createMcpClient: vi.fn(),
				getSettings: () => createDefaultControlMeshSettings("local-node"),
				async resolvePeerConnection() {
					return undefined;
				},
			},
		);

		expect(result).toEqual({
			error: "Peer endpoint and shared secret are required.",
			ok: false,
			remoteNodeId: "studio",
			type: "testPeerConnectionResult",
		});
	});
});
