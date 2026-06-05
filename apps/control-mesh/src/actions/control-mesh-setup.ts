import streamDeck, { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import * as net from "node:net";

import {
	type ControlMeshSettings,
	mergeTrustedDiscoveredPeerEndpoints,
	normalizeControlMeshSettings,
	recordPeerConnectionResult,
	upsertKnownPeer,
	upsertTrustLink,
} from "../settings/control-mesh-settings";
import { createMcpClient, type McpClient, type McpClientOptions } from "../mcp/mcp-client";
import { createPairingClient, type PairingClient, type PairingClientOptions } from "../peer-api/pairing-client";
import { createPeerClient, type PeerClient, type PeerClientOptions } from "../peer-api/peer-client";
import type { PluginRuntime } from "../plugin-runtime";
import type { DiscoveredPeer } from "../discovery/discovery-types";

type SetupPropertyInspectorMessage =
	| { localMcpUrl?: string; type: "testLocalMcp" }
	| { type: "refreshDiscovery" }
	| { peerEndpoint?: string; remoteNodeId?: string; type: "requestPairing" }
	| { remoteNodeId?: string; type: "rotatePeerSecret" }
	| { requestId?: string; type: "approvePairingRequest" }
	| { requestId?: string; type: "rejectPairingRequest" }
	| { remoteNodeId?: string; type: "testPeerConnection" }
	| { executorEnabled?: boolean; listenPort?: number; type: "validateNetworkSettings" };

type SetupPropertyInspectorResult =
	| { actionCount: number; ok: true; type: "testLocalMcpResult"; url: string }
	| { error: string; ok: false; type: "testLocalMcpResult"; url: string }
	| { discoveredPeers: DiscoveredPeer[]; ok: true; type: "refreshDiscoveryResult" }
	| { error: string; ok: false; type: "refreshDiscoveryResult" }
	| { ok: true; remoteNodeId: string; type: "testPeerConnectionResult" }
	| { error: string; ok: false; remoteNodeId: string; type: "testPeerConnectionResult" }
	| { listenPort: number; ok: true; type: "validateNetworkSettingsResult" }
	| { error: string; listenPort: number; ok: false; type: "validateNetworkSettingsResult" }
	| { ok: true; remoteNodeId: string; type: "requestPairingResult" }
	| { error: string; ok: false; remoteNodeId: string; type: "requestPairingResult" }
	| { ok: true; remoteNodeId: string; type: "rotatePeerSecretResult" }
	| { error: string; ok: false; remoteNodeId: string; type: "rotatePeerSecretResult" }
	| { ok: true; type: "pairingDecisionResult" };

type ControlMeshSetupSettings = Record<string, never>;

const LOCAL_MCP_TEST_TIMEOUT_MS = 3_000;

/**
 * Dependencies used by the setup action when testing configured connections.
 */
export type ControlMeshSetupDependencies = {
	approvePairingRequest(requestId: string): void;
	createMcpClient(input: McpClientOptions): Pick<McpClient, "listActions">;
	createPairingClient(input: PairingClientOptions): Pick<PairingClient, "requestPairing">;
	createPeerClient(input: PeerClientOptions): Pick<PeerClient, "health" | "rotateSecret">;
	getSettings(): ControlMeshSettings | Promise<ControlMeshSettings>;
	isPortAvailable?: (host: string, port: number) => Promise<boolean>;
	refreshDiscovery(): Promise<{ discoveredPeers: DiscoveredPeer[]; ok: boolean; error?: string }>;
	rejectPairingRequest(requestId: string): void;
	resolvePeerConnection: PluginRuntime["resolvePeerConnection"];
	setSettings(settings: ControlMeshSettings): Promise<void>;
};

/**
 * Constructor dependencies for the Stream Deck setup action.
 */
export type ControlMeshSetupOptions = {
	approvePairingRequest?: (requestId: string) => void;
	createPairingClient?: typeof createPairingClient;
	createMcpClient?: typeof createMcpClient;
	createPeerClient?: typeof createPeerClient;
	rejectPairingRequest?: (requestId: string) => void;
	runtime: Pick<PluginRuntime, "refreshDiscovery" | "resolvePeerConnection">;
	setPairingApprovalVisible?: (visible: boolean) => void;
};

/**
 * Handles one setup property-inspector request and returns a structured result.
 */
export async function handleSetupPropertyInspectorMessage(
	message: SetupPropertyInspectorMessage,
	dependencies: ControlMeshSetupDependencies,
): Promise<SetupPropertyInspectorResult | undefined> {
	if (message.type === "testLocalMcp") {
		return testLocalMcp(message.localMcpUrl, dependencies);
	}

	if (message.type === "refreshDiscovery") {
		return refreshDiscovery(dependencies);
	}

	if (message.type === "requestPairing") {
		return requestPairing(message, dependencies);
	}

	if (message.type === "rotatePeerSecret") {
		return rotatePeerSecret(message, dependencies);
	}

	if (message.type === "approvePairingRequest") {
		if (message.requestId) {
			dependencies.approvePairingRequest(message.requestId);
		}
		return { ok: true, type: "pairingDecisionResult" };
	}

	if (message.type === "rejectPairingRequest") {
		if (message.requestId) {
			dependencies.rejectPairingRequest(message.requestId);
		}
		return { ok: true, type: "pairingDecisionResult" };
	}

	if (message.type === "testPeerConnection") {
		return testPeerConnection(message, dependencies);
	}

	if (message.type === "validateNetworkSettings") {
		return validateNetworkSettings(message, dependencies);
	}

	return undefined;
}

/**
 * Stream Deck action that exposes Control Mesh global setup in its property inspector.
 */
@action({ UUID: "dev.jerez.sds.control-mesh.setup" })
export class ControlMeshSetup extends SingletonAction {
	readonly #approvePairingRequest: (requestId: string) => void;
	readonly #createPairingClient: typeof createPairingClient;
	readonly #createMcpClient: typeof createMcpClient;
	readonly #createPeerClient: typeof createPeerClient;
	readonly #rejectPairingRequest: (requestId: string) => void;
	readonly #runtime: Pick<PluginRuntime, "refreshDiscovery" | "resolvePeerConnection">;
	readonly #setPairingApprovalVisible: (visible: boolean) => void;

	constructor(options: ControlMeshSetupOptions) {
		super();
		this.#approvePairingRequest = options.approvePairingRequest ?? (() => undefined);
		this.#createPairingClient = options.createPairingClient ?? createPairingClient;
		this.#createMcpClient = options.createMcpClient ?? createMcpClient;
		this.#createPeerClient = options.createPeerClient ?? createPeerClient;
		this.#rejectPairingRequest = options.rejectPairingRequest ?? (() => undefined);
		this.#runtime = options.runtime;
		this.#setPairingApprovalVisible = options.setPairingApprovalVisible ?? (() => undefined);
	}

	/**
	 * Leaves the key title untouched unless the user configures one through Stream Deck.
	 */
	override onWillAppear(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Shows temporary OK feedback; the setup action's main purpose is its property inspector.
	 */
	override onKeyDown(ev: KeyDownEvent): Promise<void> {
		return ev.action.showOk();
	}

	/**
	 * Marks this setup property inspector as available for live pairing approval.
	 */
	override onPropertyInspectorDidAppear(): void {
		this.#setPairingApprovalVisible(true);
	}

	/**
	 * Rejects in-flight live pairing requests when the setup property inspector closes.
	 */
	override onPropertyInspectorDidDisappear(): void {
		this.#setPairingApprovalVisible(false);
	}

	/**
	 * Handles setup UI test operations and returns results to the visible property inspector.
	 */
	override async onSendToPlugin(
		ev: SendToPluginEvent<SetupPropertyInspectorMessage, ControlMeshSetupSettings>,
	): Promise<void> {
		streamDeck.logger.debug(`Control Mesh setup PI request: ${JSON.stringify(ev.payload)}`);

		const result = await handleSetupPropertyInspectorMessage(ev.payload, {
			approvePairingRequest: this.#approvePairingRequest,
			createPairingClient: this.#createPairingClient,
			createMcpClient: this.#createMcpClient,
			createPeerClient: this.#createPeerClient,
			getSettings: () => streamDeck.settings.getGlobalSettings<ControlMeshSettings>(),
			isPortAvailable,
			refreshDiscovery: () => this.#runtime.refreshDiscovery(),
			rejectPairingRequest: this.#rejectPairingRequest,
			resolvePeerConnection: (nodeId) => this.#runtime.resolvePeerConnection(nodeId),
			setSettings: (settings) => streamDeck.settings.setGlobalSettings(settings),
		});

		if (result) {
			streamDeck.logger.debug(`Control Mesh setup PI result: ${JSON.stringify(result)}`);
			await streamDeck.ui.sendToPropertyInspector(result);
		}
	}
}

async function validateNetworkSettings(
	message: Extract<SetupPropertyInspectorMessage, { type: "validateNetworkSettings" }>,
	dependencies: ControlMeshSetupDependencies,
): Promise<Extract<SetupPropertyInspectorResult, { type: "validateNetworkSettingsResult" }>> {
	const settings = normalizeControlMeshSettings(await dependencies.getSettings());
	const listenPort = Number(message.listenPort) || settings.executor.listenPort;

	if (!isValidPort(listenPort)) {
		return {
			error: "Listen port must be between 1 and 65535.",
			listenPort,
			ok: false,
			type: "validateNetworkSettingsResult",
		};
	}

	if (!message.executorEnabled) {
		return {
			listenPort,
			ok: true,
			type: "validateNetworkSettingsResult",
		};
	}

	const available = await (dependencies.isPortAvailable ?? isPortAvailable)(settings.executor.listenHost, listenPort);
	if (!available) {
		return {
			error: `Port ${listenPort} is already in use.`,
			listenPort,
			ok: false,
			type: "validateNetworkSettingsResult",
		};
	}

	return {
		listenPort,
		ok: true,
		type: "validateNetworkSettingsResult",
	};
}

async function requestPairing(
	message: Extract<SetupPropertyInspectorMessage, { type: "requestPairing" }>,
	dependencies: ControlMeshSetupDependencies,
): Promise<Extract<SetupPropertyInspectorResult, { type: "requestPairingResult" }>> {
	const remoteNodeId = message.remoteNodeId?.trim() ?? "";
	const peerEndpoint = message.peerEndpoint?.trim();

	if (!remoteNodeId || !peerEndpoint) {
		return {
			error: "Peer id and endpoint are required.",
			ok: false,
			remoteNodeId,
			type: "requestPairingResult",
		};
	}

	const settings = normalizeControlMeshSettings(await dependencies.getSettings());
	const response = await dependencies.createPairingClient({ url: peerEndpoint }).requestPairing({
		endpoint: settings.executor.advertisedUrl,
		executorEnabled: settings.executor.enabled,
		node: settings.localNode,
	});

	if (!response.ok) {
		return {
			error: response.error,
			ok: false,
			remoteNodeId,
			type: "requestPairingResult",
		};
	}

	await dependencies.setSettings(
		upsertTrustLink(
			upsertKnownPeer(settings, {
				displayName: response.node.nodeName,
				endpoints: [response.endpoint || peerEndpoint],
				nodeId: response.node.nodeId,
			}),
			{
				remoteNodeId: response.node.nodeId,
				sharedSecret: response.sharedSecret,
			},
		),
	);

	return {
		ok: true,
		remoteNodeId: response.node.nodeId,
		type: "requestPairingResult",
	};
}

async function rotatePeerSecret(
	message: Extract<SetupPropertyInspectorMessage, { type: "rotatePeerSecret" }>,
	dependencies: ControlMeshSetupDependencies,
): Promise<Extract<SetupPropertyInspectorResult, { type: "rotatePeerSecretResult" }>> {
	const remoteNodeId = message.remoteNodeId?.trim() ?? "";
	if (!remoteNodeId) {
		return {
			error: "Peer id is required.",
			ok: false,
			remoteNodeId,
			type: "rotatePeerSecretResult",
		};
	}

	const connection = await dependencies.resolvePeerConnection(remoteNodeId);
	if (!connection) {
		return {
			error: "Peer connection is not configured.",
			ok: false,
			remoteNodeId,
			type: "rotatePeerSecretResult",
		};
	}

	const sharedSecret = createSharedSecret();
	try {
		await dependencies
			.createPeerClient({
				localNodeId: connection.localNodeId,
				secret: connection.secret,
				url: connection.url,
			})
			.rotateSecret(sharedSecret);

		await dependencies.setSettings(
			upsertTrustLink(normalizeControlMeshSettings(await dependencies.getSettings()), {
				remoteNodeId,
				sharedSecret,
			}),
		);

		return {
			ok: true,
			remoteNodeId,
			type: "rotatePeerSecretResult",
		};
	} catch (error) {
		return {
			error: getPeerErrorMessage(error, connection.url),
			ok: false,
			remoteNodeId,
			type: "rotatePeerSecretResult",
		};
	}
}

async function testLocalMcp(
	localMcpUrl: string | undefined,
	dependencies: ControlMeshSetupDependencies,
): Promise<Extract<SetupPropertyInspectorResult, { type: "testLocalMcpResult" }>> {
	const settings = normalizeControlMeshSettings(await dependencies.getSettings());
	const url = localMcpUrl?.trim() || settings.executor.localMcpUrl;

	try {
		const actions = await dependencies.createMcpClient({ timeoutMs: LOCAL_MCP_TEST_TIMEOUT_MS, url }).listActions();

		return {
			actionCount: actions.length,
			ok: true,
			type: "testLocalMcpResult",
			url,
		};
	} catch (error) {
		return {
			error: getLocalMcpErrorMessage(error, url),
			ok: false,
			type: "testLocalMcpResult",
			url,
		};
	}
}

async function testPeerConnection(
	message: Extract<SetupPropertyInspectorMessage, { type: "testPeerConnection" }>,
	dependencies: ControlMeshSetupDependencies,
): Promise<Extract<SetupPropertyInspectorResult, { type: "testPeerConnectionResult" }>> {
	const nodeId = message.remoteNodeId?.trim();
	if (!nodeId) {
		return {
			error: "Peer id is required.",
			ok: false,
			remoteNodeId: "",
			type: "testPeerConnectionResult",
		};
	}

	const settings = normalizeControlMeshSettings(await dependencies.getSettings());
	const resolvedConnection = await dependencies.resolvePeerConnection(nodeId);
	const connection = {
		localNodeId: resolvedConnection?.localNodeId ?? settings.localNode.nodeId,
		secret: resolvedConnection?.secret,
		url: resolvedConnection?.url,
	};

	if (!connection.url || !connection.secret) {
		return {
			error: "Peer endpoint and shared secret are required.",
			ok: false,
			remoteNodeId: nodeId,
			type: "testPeerConnectionResult",
		};
	}

	try {
		const health = await dependencies
			.createPeerClient({
				localNodeId: connection.localNodeId,
				secret: connection.secret,
				url: connection.url,
			})
			.health();

		if (health.node.nodeId !== nodeId) {
			const error = `Peer responded as ${health.node.nodeId} instead of ${nodeId}.`;
			await dependencies.setSettings(recordPeerConnectionResult(settings, { error, nodeId, ok: false }));
			return {
				error,
				ok: false,
				remoteNodeId: nodeId,
				type: "testPeerConnectionResult",
			};
		}

		await dependencies.setSettings(recordPeerConnectionResult(settings, { nodeId, ok: true }));

		return {
			ok: true,
			remoteNodeId: nodeId,
			type: "testPeerConnectionResult",
		};
	} catch (error) {
		const message = getPeerErrorMessage(error, connection.url);
		await dependencies.setSettings(recordPeerConnectionResult(settings, { error: message, nodeId, ok: false }));
		return {
			error: message,
			ok: false,
			remoteNodeId: nodeId,
			type: "testPeerConnectionResult",
		};
	}
}

async function refreshDiscovery(
	dependencies: ControlMeshSetupDependencies,
): Promise<Extract<SetupPropertyInspectorResult, { type: "refreshDiscoveryResult" }>> {
	const result = await dependencies.refreshDiscovery();

	if (!result.ok) {
		return {
			error: result.error ?? "Discovery is not available.",
			ok: false,
			type: "refreshDiscoveryResult",
		};
	}

	const settings = normalizeControlMeshSettings(await dependencies.getSettings());
	const mergedSettings = mergeTrustedDiscoveredPeerEndpoints(settings, result.discoveredPeers);
	if (mergedSettings !== settings) {
		await dependencies.setSettings(mergedSettings);
	}

	return {
		discoveredPeers: result.discoveredPeers,
		ok: true,
		type: "refreshDiscoveryResult",
	};
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Connection test failed.";
}

function getLocalMcpErrorMessage(error: unknown, url: string): string {
	const message = getErrorMessage(error);
	const endpoint = formatEndpoint(url);

	if (message === "fetch failed") {
		return `MCP is not running at ${endpoint}. Start the Elgato MCP server or update the Local MCP URL.`;
	}

	if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
		return `MCP did not respond at ${endpoint} within ${LOCAL_MCP_TEST_TIMEOUT_MS / 1_000} seconds.`;
	}

	return message;
}

function getPeerErrorMessage(error: unknown, url: string): string {
	const message = getErrorMessage(error);
	if (message === "fetch failed") {
		const endpoint = formatEndpoint(url);
		const mcpPathHint = isPeerPathMistakenlyUsingMcpEndpoint(url)
			? " Ensure this is the peer API base URL (for example http://host:38765), not an Elgato MCP /mcp endpoint."
			: "";
		return `Peer API is not reachable at ${endpoint}.${mcpPathHint} Verify the peer is running and reachable from this machine.`;
	}

	return `Peer API rejected the request: ${message}`;
}

function createSharedSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function formatEndpoint(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
	} catch {
		return url;
	}
}

function isPeerPathMistakenlyUsingMcpEndpoint(url: string): boolean {
	try {
		const parsed = new URL(url);
		const normalizedPath = parsed.pathname.replace(/\/+$/, "").toLowerCase();
		return normalizedPath === "/mcp";
	} catch {
		return false;
	}
}

function isPortAvailable(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once("error", () => {
			resolve(false);
		});
		server.once("listening", () => {
			server.close(() => {
				resolve(true);
			});
		});
		server.listen(port, host);
	});
}

function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port > 0 && port <= 65_535;
}
