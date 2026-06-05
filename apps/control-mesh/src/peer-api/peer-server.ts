import * as http from "node:http";

import { createNonceCache, type NonceCache, verifyPeerRequest } from "../security/hmac";
import type { LocalNode } from "../settings/control-mesh-settings";
import type { McpTool } from "../mcp/mcp-client";

import type {
	ExecuteRemoteActionResponse,
	PeerExecutorStatus,
	PeerHealthResponse,
	RemoteActionMetadata,
} from "./peer-api-types";
import type { PairingRequest, PairingResponse } from "./pairing-types";

/**
 * Dependencies used by the Control Mesh peer API server.
 */
export type PeerServerOptions = {
	/**
	 * Executes one local MCP action by id.
	 */
	executeAction(actionId: string): Promise<unknown>;
	/**
	 * Reads current local executor health.
	 */
	getExecutorStatus(): Promise<PeerExecutorStatus>;
	/**
	 * Reads local node identity.
	 */
	getLocalNode(): LocalNode | Promise<LocalNode>;
	/**
	 * Lists local MCP actions exposed through the peer API.
	 */
	listActions(): Promise<McpTool[]>;
	nonceCache?: NonceCache;
	/**
	 * Handles one unauthenticated, live-approved pairing request.
	 */
	requestPairing?: (request: PairingRequest) => Promise<PairingResponse>;
	/**
	 * Resolves the shared secret for one remote sender node id.
	 */
	resolveSecret(nodeId: string): Promise<string | undefined> | string | undefined;
	/**
	 * Stores a rotated shared secret for one authenticated sender node id.
	 */
	rotateSecret?(nodeId: string, sharedSecret: string): Promise<void> | void;
	version?: string;
};

/**
 * Host and port requested when starting the peer API server.
 */
export type PeerServerListenOptions = {
	host: string;
	port: number;
};

/**
 * Running peer API server lifecycle handle.
 */
export type PeerServer = {
	/**
	 * Stops the HTTP server if it is currently listening.
	 */
	close(): Promise<void>;
	/**
	 * Starts the HTTP server and returns the reachable local URL.
	 */
	listen(options: PeerServerListenOptions): Promise<{ url: string }>;
};

/**
 * Creates the native HTTP peer API server used by executor nodes.
 */
export function createPeerServer(input: PeerServerOptions): PeerServer {
	const nonceCache = input.nonceCache ?? createNonceCache();
	const server = http.createServer((request, response) => {
		void handleRequest(request, response, input, nonceCache);
	});

	return {
		close() {
			return closeServer(server);
		},
		listen(options) {
			return listen(server, options);
		},
	};
}

async function handleRequest(
	request: http.IncomingMessage,
	response: http.ServerResponse,
	input: PeerServerOptions,
	nonceCache: NonceCache,
): Promise<void> {
	const method = request.method?.toUpperCase() ?? "";
	const path = getRequestPath(request);

	if (method === "POST" && path === "/pair") {
		await handlePairingRequest(request, response, input);
		return;
	}

	const route = matchRoute(method, path);

	if (!route) {
		writeJson(response, 404, { error: "Not found." });
		return;
	}

	const body = await readRequestBody(request);
	const verification = await verifyPeerRequest({
		body,
		headers: getAuthHeaders(request),
		method,
		nonceCache,
		path,
		resolveSecret: input.resolveSecret,
	});

	if (!verification.ok) {
		writeJson(response, 401, { error: verification.error });
		return;
	}

	await route(response, input, body, verification.senderNodeId);
}

async function handlePairingRequest(
	request: http.IncomingMessage,
	response: http.ServerResponse,
	input: PeerServerOptions,
): Promise<void> {
	if (!input.requestPairing) {
		writeJson(response, 503, { error: "Pairing approval is not available.", ok: false } satisfies PairingResponse);
		return;
	}

	const parsedBody = parsePairingBody(await readRequestBody(request));
	if (!parsedBody.ok) {
		writeJson(response, 400, parsedBody);
		return;
	}

	const result = await input.requestPairing(parsedBody.value);
	writeJson(response, result.ok ? 200 : 403, result);
}

type RouteHandler = (
	response: http.ServerResponse,
	input: PeerServerOptions,
	body: string,
	senderNodeId: string,
) => Promise<void>;

function matchRoute(method: string, path: string): RouteHandler | undefined {
	if (method === "GET" && path === "/health") {
		return handleHealth;
	}

	if (method === "GET" && path === "/actions") {
		return handleListActions;
	}

	if (method === "POST" && path.startsWith("/actions/") && path.endsWith("/execute")) {
		return handleExecuteAction;
	}

	if (method === "POST" && path === "/trust-link/rotate") {
		return handleRotateTrustLink;
	}

	return undefined;
}

async function handleHealth(response: http.ServerResponse, input: PeerServerOptions): Promise<void> {
	const health: PeerHealthResponse = {
		executor: await input.getExecutorStatus(),
		node: await input.getLocalNode(),
		version: input.version ?? "0.1.0",
	};

	writeJson(response, 200, health);
}

async function handleListActions(response: http.ServerResponse, input: PeerServerOptions): Promise<void> {
	try {
		writeJson(response, 200, mapMcpTools(await input.listActions()));
	} catch (error) {
		writeJson(response, 502, { error: getErrorMessage(error), ok: false });
	}
}

async function handleExecuteAction(response: http.ServerResponse, input: PeerServerOptions): Promise<void> {
	const actionId = getActionId(getRequestPath(response.req));

	try {
		// Control Mesh delegates executable-action eligibility to Elgato MCP instead
		// of mirroring that allowlist locally.
		const result = await input.executeAction(actionId);
		writeJson(response, 200, { ok: true, result } satisfies ExecuteRemoteActionResponse);
	} catch (error) {
		writeJson(response, 502, { error: getErrorMessage(error), ok: false } satisfies ExecuteRemoteActionResponse);
	}
}

async function handleRotateTrustLink(
	response: http.ServerResponse,
	input: PeerServerOptions,
	body: string,
	senderNodeId: string,
): Promise<void> {
	if (!input.rotateSecret) {
		writeJson(response, 503, { error: "Trust-link rotation is not available.", ok: false });
		return;
	}

	const parsedBody = parseRotateTrustLinkBody(body);
	if (!parsedBody.ok) {
		writeJson(response, 400, parsedBody);
		return;
	}

	await input.rotateSecret(senderNodeId, parsedBody.value.sharedSecret);
	writeJson(response, 200, { ok: true });
}

function mapMcpTools(tools: McpTool[]): RemoteActionMetadata[] {
	return tools.map((tool) => ({
		...(tool.description ? { description: tool.description } : {}),
		id: tool.id,
		name: tool.name,
		...(tool.title ? { title: tool.title } : {}),
	}));
}

function parseRotateTrustLinkBody(
	body: string,
): { ok: true; value: { sharedSecret: string } } | { error: string; ok: false } {
	try {
		const parsed = JSON.parse(body || "{}") as { sharedSecret?: unknown };
		const sharedSecret = typeof parsed.sharedSecret === "string" ? parsed.sharedSecret.trim() : "";

		if (!sharedSecret) {
			return { error: "Shared secret is required.", ok: false };
		}

		return { ok: true, value: { sharedSecret } };
	} catch {
		return { error: "Request body must be valid JSON.", ok: false };
	}
}

function parsePairingBody(body: string): { ok: true; value: PairingRequest } | { error: string; ok: false } {
	try {
		const parsed = JSON.parse(body || "{}") as Partial<PairingRequest>;
		const nodeId = parsed.node?.nodeId?.trim();
		const nodeName = parsed.node?.nodeName?.trim();
		const endpoint = parsed.endpoint?.trim();
		const executorEnabled = parsed.executorEnabled === true;

		if (!nodeId || !nodeName || !endpoint) {
			return { error: "Pairing request requires node id, node name, and endpoint.", ok: false };
		}

		return {
			ok: true,
			value: {
				endpoint,
				executorEnabled,
				node: {
					nodeId,
					nodeName,
				},
			},
		};
	} catch {
		return { error: "Pairing request body must be valid JSON.", ok: false };
	}
}

function getActionId(path: string): string {
	const prefix = "/actions/";
	const suffix = "/execute";
	return decodeURIComponent(path.slice(prefix.length, -suffix.length));
}

function getRequestPath(request: http.IncomingMessage): string {
	const url = new URL(request.url ?? "/", "http://control-mesh.local");
	return url.pathname;
}

function getAuthHeaders(request: http.IncomingMessage): Parameters<typeof verifyPeerRequest>[0]["headers"] {
	return {
		"x-control-mesh-node-id": getHeaderValue(request, "x-control-mesh-node-id"),
		"x-control-mesh-nonce": getHeaderValue(request, "x-control-mesh-nonce"),
		"x-control-mesh-signature": getHeaderValue(request, "x-control-mesh-signature"),
		"x-control-mesh-timestamp": getHeaderValue(request, "x-control-mesh-timestamp"),
	};
}

function getHeaderValue(request: http.IncomingMessage, headerName: string): string | undefined {
	const value = request.headers[headerName];
	return Array.isArray(value) ? value[0] : value;
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
	}

	return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: http.ServerResponse, status: number, body: unknown): void {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(body));
}

function listen(server: http.Server, options: PeerServerListenOptions): Promise<{ url: string }> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port, options.host, () => {
			server.off("error", reject);
			const address = server.address();

			if (!address || typeof address === "string") {
				reject(new Error("Peer API server did not expose a TCP address."));
				return;
			}

			resolve({ url: `http://${options.host}:${address.port}` });
		});
	});
}

function closeServer(server: http.Server): Promise<void> {
	if (!server.listening) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Peer API request failed.";
}
