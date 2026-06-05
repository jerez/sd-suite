import { signPeerRequest } from "../security/hmac";

import type { ExecuteRemoteActionResponse, PeerHealthResponse, RemoteActionMetadata } from "./peer-api-types";

/**
 * Configuration for a client that calls one trusted Control Mesh peer.
 */
export type PeerClientOptions = {
	fetch?: typeof fetch;
	localNodeId: string;
	secret: string;
	url: string;
};

/**
 * Client for the authenticated Control Mesh peer API.
 */
export type PeerClient = {
	/**
	 * Executes one remote action id.
	 */
	execute(actionId: string): Promise<ExecuteRemoteActionResponse>;
	/**
	 * Reads the remote executor identity and health.
	 */
	health(): Promise<PeerHealthResponse>;
	/**
	 * Lists official MCP actions exposed by the remote executor.
	 */
	listActions(): Promise<RemoteActionMetadata[]>;
	/**
	 * Rotates the shared secret for this trusted peer relationship.
	 */
	rotateSecret(sharedSecret: string): Promise<{ ok: true }>;
};

/**
 * Creates a signed HTTP client for one configured peer relationship.
 */
export function createPeerClient(input: PeerClientOptions): PeerClient {
	const fetchImpl = input.fetch ?? fetch;

	return {
		execute(actionId) {
			return requestJson<ExecuteRemoteActionResponse>({
				body: "",
				fetchImpl,
				input,
				method: "POST",
				path: `/actions/${encodeURIComponent(actionId)}/execute`,
				readStructuredError: true,
			});
		},
		health() {
			return requestJson<PeerHealthResponse>({
				body: "",
				fetchImpl,
				input,
				method: "GET",
				path: "/health",
				readStructuredError: false,
			});
		},
		listActions() {
			return requestJson<RemoteActionMetadata[]>({
				body: "",
				fetchImpl,
				input,
				method: "GET",
				path: "/actions",
				readStructuredError: false,
			});
		},
		rotateSecret(sharedSecret) {
			return requestJson<{ ok: true }>({
				body: JSON.stringify({ sharedSecret }),
				fetchImpl,
				input,
				method: "POST",
				path: "/trust-link/rotate",
				readStructuredError: true,
			});
		},
	};
}

async function requestJson<TResult>(request: {
	body: string;
	fetchImpl: typeof fetch;
	input: PeerClientOptions;
	method: string;
	path: string;
	readStructuredError: boolean;
}): Promise<TResult> {
	const url = new URL(request.path, request.input.url);
	const signed = await signPeerRequest({
		body: request.body,
		method: request.method,
		path: url.pathname,
		secret: request.input.secret,
		senderNodeId: request.input.localNodeId,
	});
	const response = await request.fetchImpl(url, {
		body: request.body || undefined,
		headers: {
			...signed.headers,
			...(request.body ? { "Content-Type": "application/json" } : {}),
		},
		method: request.method,
	});

	if (!response.ok && !request.readStructuredError) {
		throw new Error(`Peer API HTTP ${response.status}: ${await response.text()}`);
	}

	return (await response.json()) as TResult;
}
