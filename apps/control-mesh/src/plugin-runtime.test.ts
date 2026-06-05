import { describe, expect, it, vi } from "vitest";

import { createDefaultControlMeshSettings } from "./settings/control-mesh-settings";
import { createPluginRuntime, isRemoteDiscoveredPeer } from "./plugin-runtime";
import type { createPeerServer } from "./peer-api/peer-server";
import type { DiscoveredPeer } from "./discovery/discovery-types";

describe("createPluginRuntime", () => {
	it("refreshes discovery on demand even when this node does not expose actions", async () => {
		const discovery = {
			onPeer: vi.fn(),
			startAdvertising: vi.fn(),
			startBrowsing: vi.fn(),
			stop: vi.fn(),
		};
		const runtime = createPluginRuntime({
			discovery,
			discoverySettleMs: 0,
			getSettings: async () => ({
				...createDefaultControlMeshSettings("node-a"),
				executor: {
					advertisedUrl: "http://node-a.local:38765",
					enabled: false,
					listenHost: "localhost",
					listenPort: 0,
					localMcpUrl: "http://localhost:9090/mcp",
				},
			}),
			onDiscoveredPeer: vi.fn(),
		});

		const result = await runtime.refreshDiscovery();

		expect(discovery.startBrowsing).toHaveBeenCalledTimes(1);
		expect(discovery.startAdvertising).not.toHaveBeenCalled();
		expect(result).toEqual({
			discoveredPeers: [],
			ok: true,
		});
	});

	it("returns peers found by the first asynchronous discovery refresh", async () => {
		const discoveredPeer: DiscoveredPeer = {
			discoveredAt: "2026-06-02T00:00:00.000Z",
			endpoint: "http://studio.local:38765",
			executorEnabled: true,
			nodeId: "studio",
			nodeName: "Studio",
			version: "0.1.0",
		};
		const startBrowsing = vi.fn();
		const runtime = createPluginRuntime({
			createDiscovery: (onPeer) => ({
				startAdvertising: vi.fn(),
				startBrowsing: async () => {
					startBrowsing();
					setTimeout(() => onPeer(discoveredPeer), 5);
				},
				stop: vi.fn(),
			}),
			discoverySettleMs: 20,
			getSettings: async () => createDefaultControlMeshSettings("node-a"),
		});

		const result = await runtime.refreshDiscovery();

		expect(startBrowsing).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			discoveredPeers: [discoveredPeer],
			ok: true,
		});
	});

	it("replaces stale discovered peers on a later refresh", async () => {
		const discoveredPeer: DiscoveredPeer = {
			discoveredAt: "2026-06-02T00:00:00.000Z",
			endpoint: "http://studio.local:38765",
			executorEnabled: true,
			nodeId: "studio",
			nodeName: "Studio",
			version: "0.1.0",
		};
		let browseCount = 0;
		const runtime = createPluginRuntime({
			createDiscovery: (onPeer) => ({
				startAdvertising: vi.fn(),
				startBrowsing: async () => {
					browseCount += 1;
					if (browseCount === 1) {
						onPeer(discoveredPeer);
					}
				},
				stop: vi.fn(),
			}),
			discoverySettleMs: 0,
			getSettings: async () => createDefaultControlMeshSettings("node-a"),
		});

		await expect(runtime.refreshDiscovery()).resolves.toEqual({
			discoveredPeers: [discoveredPeer],
			ok: true,
		});
		await expect(runtime.refreshDiscovery()).resolves.toEqual({
			discoveredPeers: [],
			ok: true,
		});
	});

	it("identifies this node as a non-remote discovery result", () => {
		const peer: DiscoveredPeer = {
			discoveredAt: "2026-06-02T00:00:00.000Z",
			endpoint: "http://node-a.local:38765",
			executorEnabled: true,
			nodeId: "node-a",
			nodeName: "This Node",
			version: "0.1.0",
		};

		expect(isRemoteDiscoveredPeer(peer, "node-a")).toBe(false);
		expect(isRemoteDiscoveredPeer({ ...peer, nodeId: "studio" }, "node-a")).toBe(true);
	});

	it("starts peer server and advertiser when executor is enabled", async () => {
		const peerServer = { close: vi.fn(), listen: vi.fn(async () => ({ url: "http://localhost:38765" })) };
		const discovery = { startAdvertising: vi.fn(), startBrowsing: vi.fn(), stop: vi.fn() };
		const runtime = createPluginRuntime({
			discovery,
			getSettings: async () => ({
				...createDefaultControlMeshSettings("node-a"),
				executor: {
					advertisedUrl: "http://node-a.local:38765",
					enabled: true,
					listenHost: "localhost",
					listenPort: 0,
					localMcpUrl: "http://localhost:9090/mcp",
				},
			}),
			peerServer,
		});

		await runtime.start();
		await runtime.stop();

		expect(peerServer.listen).toHaveBeenCalledWith({ host: "localhost", port: 0 });
		expect(discovery.startBrowsing).not.toHaveBeenCalled();
		expect(discovery.startAdvertising).toHaveBeenCalledWith({
			endpoint: "http://node-a.local:38765",
			executorEnabled: true,
			nodeId: "node-a",
			nodeName: "Control Mesh",
			version: "0.1.0",
		});
		expect(peerServer.close).toHaveBeenCalled();
		expect(discovery.stop).toHaveBeenCalled();
	});

	it("does not advertise when executor is disabled", async () => {
		const discovery = { startAdvertising: vi.fn(), startBrowsing: vi.fn(), stop: vi.fn() };
		const runtime = createPluginRuntime({
			discovery,
			getSettings: async () => ({
				...createDefaultControlMeshSettings("node-a"),
				executor: {
					advertisedUrl: "http://node-a.local:38765",
					enabled: false,
					listenHost: "localhost",
					listenPort: 0,
					localMcpUrl: "http://localhost:9090/mcp",
				},
			}),
		});

		await runtime.start();

		expect(discovery.startBrowsing).not.toHaveBeenCalled();
		expect(discovery.startAdvertising).not.toHaveBeenCalled();
	});

	it("resolves a known peer endpoint and enabled trust link", async () => {
		const settings = createDefaultControlMeshSettings("node-a");
		const runtime = createPluginRuntime({
			getSettings: async () => ({
				...settings,
				knownPeers: [
					{
						connection: { state: "confirmed" },
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
						sharedSecret: "shared-secret",
					},
				],
			}),
		});

		await expect(runtime.resolvePeerConnection("studio")).resolves.toEqual({
			localNodeId: "node-a",
			secret: "shared-secret",
			url: "http://studio.local:38765",
		});
	});

	it("stores an approved incoming pairing request and returns the generated secret", async () => {
		let settings = {
			...createDefaultControlMeshSettings("node-b"),
			executor: {
				...createDefaultControlMeshSettings("node-b").executor,
				advertisedUrl: "http://node-b.local:38765",
			},
		};
		const persistenceOrder: string[] = [];
		const requestPairingApproval = vi.fn(async () => ({ ok: true as const }));
		const onPairingAccepted = vi.fn((remoteNodeId: string) => {
			persistenceOrder.push(`accepted:${remoteNodeId}:${settings.knownPeers[0]?.nodeId ?? ""}`);
		});
		const peerServer = { close: vi.fn(), listen: vi.fn(async () => ({ url: "http://localhost:38765" })) };
		const runtime = createPluginRuntime({
			getSettings: async () => ({
				...settings,
				executor: {
					...settings.executor,
					enabled: true,
				},
				localNode: { nodeId: "node-b", nodeName: "Studio" },
			}),
			onPairingAccepted,
			peerServer,
			requestPairingApproval,
			setSettings: async (nextSettings) => {
				settings = nextSettings;
				persistenceOrder.push("settings");
			},
		});

		await runtime.start();
		const requestPairing = peerServer.listen.mock.calls[0];
		expect(requestPairing).toBeDefined();

		const result = await runtime.handlePairingRequest({
			endpoint: "http://desk.local:38765",
			executorEnabled: true,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});

		expect(requestPairingApproval).toHaveBeenCalledWith({
			endpoint: "http://desk.local:38765",
			executorEnabled: true,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});
		expect(result).toMatchObject({
			endpoint: "http://node-b.local:38765",
			node: { nodeId: "node-b", nodeName: "Studio" },
			ok: true,
		});
		expect(result.ok ? result.sharedSecret : "").toHaveLength(43);
		expect(settings.knownPeers).toEqual([
			{
				connection: { state: "untested" },
				displayName: "Desk",
				endpoints: ["http://desk.local:38765"],
				nodeId: "node-a",
			},
		]);
		expect(settings.trustLinks).toEqual([
			expect.objectContaining({
				enabled: true,
				remoteNodeId: "node-a",
				sharedSecret: result.ok ? result.sharedSecret : "",
			}),
		]);
		expect(onPairingAccepted).toHaveBeenCalledWith("node-a");
		expect(persistenceOrder).toEqual(["settings", "accepted:node-a:node-a"]);
	});

	it("stores caller-only peers without a callable endpoint after approved pairing", async () => {
		let settings = {
			...createDefaultControlMeshSettings("node-b"),
			executor: {
				...createDefaultControlMeshSettings("node-b").executor,
				advertisedUrl: "http://node-b.local:38765",
				enabled: true,
			},
		};
		const runtime = createPluginRuntime({
			getSettings: async () => ({
				...settings,
				localNode: { nodeId: "node-b", nodeName: "Studio" },
			}),
			requestPairingApproval: vi.fn(async () => ({ ok: true as const })),
			setSettings: async (nextSettings) => {
				settings = nextSettings;
			},
		});

		const result = await runtime.handlePairingRequest({
			endpoint: "http://desk.local:38765",
			executorEnabled: false,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});

		expect(result.ok).toBe(true);
		expect(settings.knownPeers).toEqual([
			{
				connection: { state: "untested" },
				displayName: "Desk",
				endpoints: [],
				nodeId: "node-a",
			},
		]);
	});

	it("resolves peer API secrets from current settings after live pairing", async () => {
		let settings = {
			...createDefaultControlMeshSettings("node-b"),
			executor: {
				...createDefaultControlMeshSettings("node-b").executor,
				advertisedUrl: "http://node-b.local:38765",
				enabled: true,
			},
		};
		let peerServerOptions: Parameters<typeof createPeerServer>[0] | undefined;
		const runtime = createPluginRuntime({
			createPeerServer: vi.fn((options) => {
				peerServerOptions = options;
				return {
					close: vi.fn(),
					listen: vi.fn(async () => ({ url: "http://localhost:38765" })),
				};
			}),
			getSettings: async () => ({
				...settings,
				localNode: { nodeId: "node-b", nodeName: "Studio" },
			}),
			requestPairingApproval: vi.fn(async () => ({ ok: true as const })),
			setSettings: async (nextSettings) => {
				settings = nextSettings;
			},
		});

		await runtime.start();
		const result = await runtime.handlePairingRequest({
			endpoint: "http://desk.local:38765",
			executorEnabled: true,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});

		await expect(Promise.resolve(peerServerOptions?.resolveSecret("node-a"))).resolves.toBe(
			result.ok ? result.sharedSecret : "",
		);
	});

	it("updates current settings when a trusted peer rotates its shared secret", async () => {
		let settings = {
			...createDefaultControlMeshSettings("node-b"),
			executor: {
				...createDefaultControlMeshSettings("node-b").executor,
				enabled: true,
			},
			trustLinks: [
				{
					createdAt: "2026-06-02T00:00:00.000Z",
					enabled: true,
					remoteNodeId: "node-a",
					secretVersion: 1,
					sharedSecret: "old-secret",
				},
			],
		};
		let peerServerOptions: Parameters<typeof createPeerServer>[0] | undefined;
		const runtime = createPluginRuntime({
			createPeerServer: vi.fn((options) => {
				peerServerOptions = options;
				return {
					close: vi.fn(),
					listen: vi.fn(async () => ({ url: "http://localhost:38765" })),
				};
			}),
			getSettings: async () => settings,
			setSettings: async (nextSettings) => {
				settings = nextSettings;
			},
		});

		await runtime.start();
		await peerServerOptions?.rotateSecret?.("node-a", "new-secret");

		expect(settings.trustLinks).toEqual([
			expect.objectContaining({
				remoteNodeId: "node-a",
				secretVersion: 2,
				sharedSecret: "new-secret",
			}),
		]);
	});
});
