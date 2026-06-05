/**
 * Stable identity for the local Control Mesh plugin instance.
 */
export type LocalNode = {
	nodeId: string;
	nodeName: string;
};

export type KnownPeerConnectionState = "untested" | "confirmed" | "failed";

/**
 * Latest local view of whether a known peer's trust link can be used.
 */
export type KnownPeerConnection = {
	lastConfirmedAt?: string;
	lastError?: string;
	lastTestedAt?: string;
	state: KnownPeerConnectionState;
};

/**
 * Persisted remote node entry that can be paired with a trust link.
 */
export type KnownPeer = {
	connection: KnownPeerConnection;
	displayName: string;
	endpoints: string[];
	nodeId: string;
};

/**
 * Input accepted when creating or replacing a known peer entry.
 */
export type KnownPeerInput = {
	connection?: Partial<KnownPeerConnection>;
	displayName: string;
	endpoints: string[];
	nodeId: string;
};

/**
 * Transient node metadata found through local-network discovery.
 */
export type DiscoveredPeer = {
	discoveredAt: string;
	endpoint: string;
	executorEnabled: boolean;
	nodeId: string;
	nodeName: string;
	version: string;
};

/**
 * Shared-secret relationship with one known peer.
 */
export type TrustLink = {
	createdAt: string;
	enabled: boolean;
	remoteNodeId: string;
	rotatedAt?: string;
	secretVersion: number;
	sharedSecret: string;
};

export type TrustLinkInput = {
	remoteNodeId: string;
	sharedSecret: string;
};

/**
 * Stream Deck global settings managed by Control Mesh.
 */
export type ControlMeshSettings = {
	executor: {
		advertisedUrl: string;
		enabled: boolean;
		listenHost: string;
		listenPort: number;
		localMcpUrl: string;
	};
	knownPeers: KnownPeer[];
	localNode: LocalNode;
	trustLinks: TrustLink[];
};

/**
 * Local runtime context used to derive settings that should not be user-authored.
 */
export type NormalizeControlMeshSettingsOptions = {
	advertisedHost?: string;
};

/**
 * Official Elgato MCP HTTP endpoint used by the documented `--http` server mode.
 */
export const DEFAULT_ELGATO_MCP_URL = "http://localhost:9090/mcp";

const DEFAULT_ADVERTISED_HOST = "localhost";
const DEFAULT_LISTEN_HOST = "0.0.0.0";
const DEFAULT_LISTEN_PORT = 38_765;

/**
 * Creates the first-run global settings shape for a local node id.
 */
export function createDefaultControlMeshSettings(
	nodeId: string,
	options: NormalizeControlMeshSettingsOptions = {},
): ControlMeshSettings {
	const advertisedHost = normalizeAdvertisedHost(options.advertisedHost) ?? DEFAULT_ADVERTISED_HOST;
	const nodeName = options.advertisedHost?.trim().replace(/[.]$/, "") || "Control Mesh";

	return {
		executor: {
			advertisedUrl: createAdvertisedUrl(advertisedHost, DEFAULT_LISTEN_PORT),
			enabled: false,
			listenHost: DEFAULT_LISTEN_HOST,
			listenPort: DEFAULT_LISTEN_PORT,
			localMcpUrl: DEFAULT_ELGATO_MCP_URL,
		},
		knownPeers: [],
		localNode: {
			nodeId,
			nodeName,
		},
		trustLinks: [],
	};
}

/**
 * Normalizes persisted global settings and migrates obsolete Control Mesh defaults.
 */
export function normalizeControlMeshSettings(
	value: unknown,
	options: NormalizeControlMeshSettingsOptions = {},
): ControlMeshSettings {
	const partialSettings = isRecord(value) ? value : {};
	const partialLocalNode = isRecord(partialSettings.localNode) ? partialSettings.localNode : {};
	const nodeId = typeof partialLocalNode.nodeId === "string" ? partialLocalNode.nodeId : createNodeId();
	const defaults = createDefaultControlMeshSettings(nodeId, options);
	const partialExecutor = isRecord(partialSettings.executor) ? partialSettings.executor : {};
	const listenPort =
		typeof partialExecutor.listenPort === "number" ? partialExecutor.listenPort : defaults.executor.listenPort;
	const advertisedHost = resolveAdvertisedHost(partialExecutor.advertisedUrl, options, defaults.executor.advertisedUrl);

	return {
		executor: {
			advertisedUrl: createAdvertisedUrl(advertisedHost, listenPort),
			enabled: typeof partialExecutor.enabled === "boolean" ? partialExecutor.enabled : defaults.executor.enabled,
			listenHost:
				typeof partialExecutor.listenHost === "string" ? partialExecutor.listenHost : defaults.executor.listenHost,
			listenPort,
			localMcpUrl:
				typeof partialExecutor.localMcpUrl === "string" ? partialExecutor.localMcpUrl : defaults.executor.localMcpUrl,
		},
		knownPeers: normalizeKnownPeers(
			Array.isArray(partialSettings.knownPeers)
				? (partialSettings.knownPeers as ControlMeshSettings["knownPeers"])
				: defaults.knownPeers,
		),
		localNode: {
			nodeId,
			nodeName: typeof partialLocalNode.nodeName === "string" ? partialLocalNode.nodeName : defaults.localNode.nodeName,
		},
		trustLinks: normalizeTrustLinks(
			Array.isArray(partialSettings.trustLinks)
				? (partialSettings.trustLinks as ControlMeshSettings["trustLinks"])
				: defaults.trustLinks,
		),
	};
}

/**
 * Inserts or replaces a known peer while preserving an explicit connection state when provided.
 */
export function upsertKnownPeer(settings: ControlMeshSettings, peer: KnownPeerInput): ControlMeshSettings {
	const next = structuredClone(settings);
	const normalizedPeer = normalizeKnownPeer(peer);
	const existingIndex = next.knownPeers.findIndex((knownPeer) => knownPeer.nodeId === peer.nodeId);

	if (existingIndex === -1) {
		next.knownPeers.push(normalizedPeer);
		return next;
	}

	next.knownPeers[existingIndex] = normalizedPeer;
	return next;
}

/**
 * Inserts or rotates the trust-link secret for one known peer relationship.
 */
export function upsertTrustLink(
	settings: ControlMeshSettings,
	input: TrustLinkInput,
	now = new Date(),
): ControlMeshSettings {
	const remoteNodeId = input.remoteNodeId.trim();
	const sharedSecret = input.sharedSecret.trim();

	if (!remoteNodeId || !sharedSecret) {
		throw new Error("Peer id and shared secret are required.");
	}

	const existingLink = settings.trustLinks.find((link) => link.remoteNodeId === remoteNodeId);
	const nextLink: TrustLink = existingLink
		? {
				...existingLink,
				rotatedAt: now.toISOString(),
				secretVersion: existingLink.secretVersion + 1,
				sharedSecret,
			}
		: {
				createdAt: now.toISOString(),
				enabled: true,
				remoteNodeId,
				secretVersion: 1,
				sharedSecret,
			};

	return {
		...settings,
		trustLinks: [...settings.trustLinks.filter((link) => link.remoteNodeId !== remoteNodeId), nextLink],
	};
}

/**
 * Clears a peer confirmation after endpoint, identity, or secret changes.
 */
export function resetPeerConfirmation(
	settings: ControlMeshSettings,
	nodeId: string,
	reason: string,
): ControlMeshSettings {
	const next = structuredClone(settings);
	const peer = next.knownPeers.find((knownPeer) => knownPeer.nodeId === nodeId);

	if (!peer) {
		return next;
	}

	peer.connection = {
		lastError: reason,
		state: "untested",
	};

	return next;
}

/**
 * Stores the latest authenticated peer test result for one known peer.
 */
export function recordPeerConnectionResult(
	settings: ControlMeshSettings,
	input: { error?: string; nodeId: string; ok: boolean },
	now = new Date(),
): ControlMeshSettings {
	const next = structuredClone(settings);
	const peer = next.knownPeers.find((knownPeer) => knownPeer.nodeId === input.nodeId);

	if (!peer) {
		return next;
	}

	peer.connection = input.ok
		? {
				lastConfirmedAt: now.toISOString(),
				lastTestedAt: now.toISOString(),
				state: "confirmed",
			}
		: {
				...(input.error ? { lastError: input.error } : {}),
				lastTestedAt: now.toISOString(),
				state: "failed",
			};

	return next;
}

/**
 * Refreshes trusted peer endpoints from current discovery results without mutating unrelated peers.
 */
export function mergeTrustedDiscoveredPeerEndpoints(
	settings: ControlMeshSettings,
	discoveredPeers: DiscoveredPeer[],
): ControlMeshSettings {
	let changed = false;
	const next = structuredClone(settings);

	for (const peer of next.knownPeers) {
		const discoveredPeer = discoveredPeers.find((item) => item.nodeId === peer.nodeId);
		if (!discoveredPeer?.executorEnabled) {
			continue;
		}

		const nextEndpoint = discoveredPeer.endpoint.trim();
		if (!nextEndpoint) {
			continue;
		}

		const currentEndpoint = peer.endpoints[0] ?? "";
		const nextDisplayName = discoveredPeer.nodeName.trim() || peer.displayName;
		if (currentEndpoint === nextEndpoint && peer.displayName === nextDisplayName) {
			continue;
		}

		peer.displayName = nextDisplayName;
		peer.endpoints = [nextEndpoint];
		changed = true;
	}

	return changed ? next : settings;
}

function normalizeKnownPeer(peer: KnownPeerInput): KnownPeer {
	return {
		connection: {
			...peer.connection,
			state: peer.connection?.state ?? "untested",
		},
		displayName: peer.displayName,
		endpoints: [...peer.endpoints],
		nodeId: peer.nodeId,
	};
}

function normalizeKnownPeers(peers: ControlMeshSettings["knownPeers"]): ControlMeshSettings["knownPeers"] {
	const mergedPeers = new Map<string, KnownPeer>();

	for (const peer of peers) {
		const nodeId = peer.nodeId.trim();
		if (!nodeId) {
			continue;
		}

		const existing = mergedPeers.get(nodeId);
		if (!existing) {
			mergedPeers.set(nodeId, {
				connection: { ...peer.connection, state: peer.connection.state ?? "untested" },
				displayName: peer.displayName,
				endpoints: [...peer.endpoints],
				nodeId,
			});
			continue;
		}

		existing.displayName = peer.displayName || existing.displayName;
		existing.endpoints = peer.endpoints.length > 0 ? [...peer.endpoints] : existing.endpoints;
		existing.connection = {
			...existing.connection,
			...peer.connection,
			state: peer.connection.state ?? existing.connection.state,
		};
	}

	return Array.from(mergedPeers.values());
}

function normalizeTrustLinks(links: ControlMeshSettings["trustLinks"]): ControlMeshSettings["trustLinks"] {
	const mergedLinks = new Map<string, TrustLink>();

	for (const link of links) {
		const remoteNodeId = link.remoteNodeId.trim();
		if (!remoteNodeId) {
			continue;
		}

		mergedLinks.set(remoteNodeId, {
			...link,
			remoteNodeId,
		});
	}

	return Array.from(mergedLinks.values());
}

function createNodeId(): string {
	return crypto.randomUUID?.() ?? "local-node";
}

function resolveAdvertisedHost(
	advertisedUrl: unknown,
	options: NormalizeControlMeshSettingsOptions,
	defaultUrl: string,
): string {
	const preferredHost = normalizeAdvertisedHost(options.advertisedHost);
	if (preferredHost) {
		return preferredHost;
	}

	const persistedHost = typeof advertisedUrl === "string" ? getUrlHostname(advertisedUrl) : undefined;
	if (persistedHost && !isLocalhost(persistedHost)) {
		return persistedHost;
	}

	return getUrlHostname(defaultUrl) ?? DEFAULT_ADVERTISED_HOST;
}

function normalizeAdvertisedHost(host: string | undefined): string | undefined {
	const normalizedHost = host?.trim().replace(/[.]$/, "");
	if (!normalizedHost) {
		return undefined;
	}

	if (isLocalhost(normalizedHost) || isIpAddress(normalizedHost) || normalizedHost.includes(".")) {
		return normalizedHost;
	}

	return `${normalizedHost}.local`;
}

function createAdvertisedUrl(host: string, port: number): string {
	return `http://${host}:${port}`;
}

function getUrlHostname(url: string): string | undefined {
	try {
		return new URL(url).hostname;
	} catch {
		return undefined;
	}
}

function isLocalhost(host: string): boolean {
	return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isIpAddress(host: string): boolean {
	return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
