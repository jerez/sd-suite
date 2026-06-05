import { createBonjourDiscoveryAdapter } from "./discovery/bonjour-discovery";
import {
	createDiscoveryService,
	type DiscoveredPeerHandler,
	type DiscoveryService,
} from "./discovery/discovery-service";
import { createMcpClient, type McpClient } from "./mcp/mcp-client";
import { createPeerServer, type PeerServer } from "./peer-api/peer-server";
import type { PairingRequest, PairingResponse } from "./peer-api/pairing-types";
import {
	type ControlMeshSettings,
	normalizeControlMeshSettings,
	upsertKnownPeer,
	upsertTrustLink,
} from "./settings/control-mesh-settings";
import type { DiscoveredPeer } from "./discovery/discovery-types";

export const CONTROL_MESH_VERSION = "0.1.0";
const DISCOVERY_REFRESH_SETTLE_MS = 500;

type DiscoveryFactory = (onPeer: DiscoveredPeerHandler) => DiscoveryService;

export type PairingApprovalResult = { ok: true } | { error: string; ok: false };

/**
 * Trusted peer endpoint and secret resolved from persisted Control Mesh settings.
 */
export type PeerConnection = {
	localNodeId: string;
	secret: string;
	url: string;
};

/**
 * Dependencies used to compose the Control Mesh plugin runtime.
 */
export type PluginRuntimeOptions = {
	/**
	 * Creates the discovery service with the runtime-owned peer callback.
	 */
	createDiscovery?: DiscoveryFactory;
	createMcpClient?: typeof createMcpClient;
	createPeerServer?: typeof createPeerServer;
	/**
	 * Milliseconds to collect asynchronous discovery callbacks before returning refresh results.
	 */
	discoverySettleMs?: number;
	discovery?: DiscoveryService;
	getSettings(): ControlMeshSettings | Promise<ControlMeshSettings>;
	/**
	 * Runs after an approved incoming pair request has been saved to settings.
	 */
	onPairingAccepted?: (remoteNodeId: string) => void;
	onDiscoveredPeer?: (peer: DiscoveredPeer) => void;
	peerServer?: PeerServer;
	requestPairingApproval?: (request: PairingRequest) => Promise<PairingApprovalResult>;
	setSettings?: (settings: ControlMeshSettings) => Promise<void>;
};

/**
 * Runtime lifecycle and settings helpers consumed by Stream Deck actions.
 */
export type PluginRuntime = {
	/**
	 * Reads current Control Mesh global settings.
	 */
	getSettings(): Promise<ControlMeshSettings>;
	/**
	 * Handles one live-approved incoming pairing request from an untrusted discovered node.
	 */
	handlePairingRequest(request: PairingRequest): Promise<PairingResponse>;
	/**
	 * Resolves a trusted peer connection for a configured remote node id.
	 */
	resolvePeerConnection(nodeId: string): Promise<PeerConnection | undefined>;
	/**
	 * Starts executor and discovery services according to current settings.
	 */
	start(): Promise<void>;
	/**
	 * Triggers a local discovery scan and returns all candidate peers discovered in memory.
	 */
	refreshDiscovery(): Promise<{ discoveredPeers: DiscoveredPeer[]; ok: boolean; error?: string }>;
	/**
	 * Stops services started by this runtime.
	 */
	stop(): Promise<void>;
};

/**
 * Creates the runtime composition used by the Stream Deck plugin process.
 */
export function createPluginRuntime(input: PluginRuntimeOptions): PluginRuntime {
	const getSettings = async () => normalizeControlMeshSettings(await input.getSettings());
	const createMcp = input.createMcpClient ?? createMcpClient;
	const createServer = input.createPeerServer ?? createPeerServer;
	let runningDiscovery: DiscoveryService | undefined;
	let runningPeerServer: PeerServer | undefined;
	let discoveredPeers = new Map<string, DiscoveredPeer>();
	let localNodeId = "";

	const notifyDiscoveredPeer = (peer: DiscoveredPeer) => {
		if (!isRemoteDiscoveredPeer(peer, localNodeId)) {
			return;
		}

		const key = `${peer.nodeId}::${peer.endpoint}`;
		discoveredPeers.set(key, peer);
		input.onDiscoveredPeer?.(peer);
	};

	const ensureDiscovery = (): DiscoveryService => {
		if (runningDiscovery) {
			return runningDiscovery;
		}

		runningDiscovery =
			input.discovery ??
			input.createDiscovery?.(notifyDiscoveredPeer) ??
			createDiscoveryService({
				adapter: createBonjourDiscoveryAdapter(),
				onPeer: notifyDiscoveredPeer,
			});
		return runningDiscovery;
	};

	const handlePairingRequest = async (request: PairingRequest): Promise<PairingResponse> => {
		if (!input.setSettings) {
			return { error: "Pairing cannot save settings on this node.", ok: false };
		}

		const settings = await getSettings();
		const approval = await approvePairingRequest(input, request);

		if (!approval.ok) {
			return approval;
		}

		const sharedSecret = createSharedSecret();
		await input.setSettings(addTrustedPeer(settings, request, sharedSecret));
		input.onPairingAccepted?.(request.node.nodeId);

		return {
			endpoint: settings.executor.advertisedUrl,
			node: settings.localNode,
			ok: true,
			sharedSecret,
		};
	};

	const rotatePeerSecret = async (nodeId: string, sharedSecret: string): Promise<void> => {
		if (!input.setSettings) {
			throw new Error("Trust-link rotation cannot save settings on this node.");
		}

		await input.setSettings(upsertTrustLink(await getSettings(), { remoteNodeId: nodeId, sharedSecret }));
	};

	return {
		getSettings,
		handlePairingRequest,
		async resolvePeerConnection(nodeId) {
			const settings = await getSettings();
			const peer = settings.knownPeers.find((knownPeer) => knownPeer.nodeId === nodeId);
			const trustLink = settings.trustLinks.find(
				(link) => link.enabled && link.remoteNodeId === nodeId && Boolean(link.sharedSecret),
			);
			const [url] = peer?.endpoints ?? [];

			if (!url || !trustLink) {
				return undefined;
			}

			return {
				localNodeId: settings.localNode.nodeId,
				secret: trustLink.sharedSecret,
				url,
			};
		},
		async start() {
			const settings = await getSettings();
			localNodeId = settings.localNode.nodeId;
			const mcpClient = createMcp({ url: settings.executor.localMcpUrl });

			if (settings.executor.enabled) {
				runningPeerServer =
					input.peerServer ??
					createServer(createPeerServerOptions(getSettings, mcpClient, handlePairingRequest, rotatePeerSecret));
				const listenResult = await runningPeerServer.listen({
					host: settings.executor.listenHost,
					port: settings.executor.listenPort,
				});

				await ensureDiscovery().startAdvertising({
					endpoint: replaceUrlPort(settings.executor.advertisedUrl, listenResult.url),
					executorEnabled: true,
					nodeId: settings.localNode.nodeId,
					nodeName: settings.localNode.nodeName,
					version: CONTROL_MESH_VERSION,
				});
			}
		},
		async refreshDiscovery() {
			const settings = await getSettings();
			localNodeId = settings.localNode.nodeId;
			discoveredPeers = new Map<string, DiscoveredPeer>();
			await ensureDiscovery().startBrowsing();
			await waitForDiscoveryCallbacks(input.discoverySettleMs ?? DISCOVERY_REFRESH_SETTLE_MS);
			return { discoveredPeers: Array.from(discoveredPeers.values()), ok: true };
		},
		async stop() {
			await runningPeerServer?.close();
			runningPeerServer = undefined;

			await runningDiscovery?.stop();
			runningDiscovery = undefined;
			discoveredPeers = new Map<string, DiscoveredPeer>();
		},
	};
}

function waitForDiscoveryCallbacks(delayMs: number): Promise<void> {
	if (delayMs <= 0) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		setTimeout(resolve, delayMs);
	});
}

function createPeerServerOptions(
	getSettings: () => Promise<ControlMeshSettings>,
	mcpClient: McpClient,
	requestPairing: (request: PairingRequest) => Promise<PairingResponse>,
	rotateSecret: (nodeId: string, sharedSecret: string) => Promise<void>,
): Parameters<typeof createPeerServer>[0] {
	return {
		executeAction(actionId) {
			return mcpClient.executeAction(actionId);
		},
		async getExecutorStatus() {
			const settings = await getSettings();
			return {
				enabled: settings.executor.enabled,
				mcpHealthy: await isMcpHealthy(mcpClient),
			};
		},
		async getLocalNode() {
			const settings = await getSettings();
			return settings.localNode;
		},
		listActions() {
			return mcpClient.listActions();
		},
		requestPairing,
		async resolveSecret(nodeId) {
			const settings = await getSettings();
			return settings.trustLinks.find((link) => link.enabled && link.remoteNodeId === nodeId)?.sharedSecret;
		},
		rotateSecret,
		version: CONTROL_MESH_VERSION,
	};
}

async function approvePairingRequest(
	input: PluginRuntimeOptions,
	request: PairingRequest,
): Promise<PairingApprovalResult> {
	if (!input.requestPairingApproval) {
		return { error: "Pairing approval is not available.", ok: false };
	}

	return input.requestPairingApproval(request);
}

function addTrustedPeer(
	settings: ControlMeshSettings,
	request: PairingRequest,
	sharedSecret: string,
): ControlMeshSettings {
	return upsertTrustLink(
		upsertKnownPeer(settings, {
			displayName: request.node.nodeName,
			endpoints: request.executorEnabled ? [request.endpoint] : [],
			nodeId: request.node.nodeId,
		}),
		{
			remoteNodeId: request.node.nodeId,
			sharedSecret,
		},
	);
}

function createSharedSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

async function isMcpHealthy(mcpClient: McpClient): Promise<boolean> {
	try {
		await mcpClient.listActions();
		return true;
	} catch {
		return false;
	}
}

function replaceUrlPort(advertisedUrl: string, listenedUrl: string): string {
	const advertised = new URL(advertisedUrl);
	const listened = new URL(listenedUrl);
	advertised.port = listened.port;

	return advertised.toString().replace(/\/$/, "");
}

/**
 * Returns whether a discovery candidate belongs to another Control Mesh node.
 */
export function isRemoteDiscoveredPeer(peer: DiscoveredPeer, localNodeId: string): boolean {
	return peer.nodeId !== localNodeId;
}
