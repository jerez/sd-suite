import { describe, expect, it, vi } from "vitest";

import { createMcpClient } from "./mcp-client";

const MCP_PROTOCOL_VERSION = "2025-11-25";

describe("createMcpClient", () => {
	it("initializes an MCP HTTP session before listing executable actions", async () => {
		const requests: RecordedMcpRequest[] = [];
		const fetch = createSessionFetch(requests, {
			"tools/call": (id, params) =>
				params?.name === "streamdeck__get_executable_actions"
					? jsonRpcResponse(id, {
							content: [
								{
									text: JSON.stringify({
										actions: [
											{
												description: {
													description: "Turns the studio lights on.",
													name: "Lights On",
												},
												id: "runtime-action-id",
											},
										],
									}),
									type: "text",
								},
							],
						})
					: jsonRpcErrorResponse(id, -32601, "missing"),
		});
		const client = createMcpClient({ fetch, url: "http://localhost:9090/mcp" });

		await expect(client.listActions()).resolves.toEqual([
			{
				description: "Turns the studio lights on.",
				id: "runtime-action-id",
				name: "Lights On",
			},
		]);

		expect(requests.map((request) => request.method)).toEqual([
			"initialize",
			"notifications/initialized",
			"tools/call",
		]);
		expect(requests.at(-1)).toEqual(
			expect.objectContaining({
				body: expect.objectContaining({
					params: { arguments: {}, name: "streamdeck__get_executable_actions" },
				}),
				protocolVersion: MCP_PROTOCOL_VERSION,
				sessionId: "control-mesh-session",
			}),
		);
	});

	it("executes one runtime action id through the official MCP bridge tool", async () => {
		const requests: RecordedMcpRequest[] = [];
		const fetch = createSessionFetch(requests, {
			"tools/call": (id, params) =>
				params?.name === "streamdeck__execute_action"
					? jsonRpcResponse(id, { content: [{ text: '{"status":"ok"}', type: "text" }] })
					: jsonRpcErrorResponse(id, -32601, "missing"),
		});
		const client = createMcpClient({ fetch, url: "http://localhost:9090/mcp" });

		await expect(client.executeAction("runtime-action-id")).resolves.toEqual({ status: "ok" });

		expect(requests.at(-1)).toEqual(
			expect.objectContaining({
				body: expect.objectContaining({
					method: "tools/call",
					params: { arguments: { id: "runtime-action-id" }, name: "streamdeck__execute_action" },
				}),
				sessionId: "control-mesh-session",
			}),
		);
	});

	it("returns MCP tool errors while loading executable actions", async () => {
		const fetch = createSessionFetch([], {
			"tools/call": (id) => jsonRpcErrorResponse(id, -32601, "missing"),
		});
		const client = createMcpClient({ fetch, url: "http://localhost:9090/mcp" });

		await expect(client.listActions()).rejects.toThrow("missing");
	});

	it("reinitializes once when the MCP session expires", async () => {
		const requests: RecordedMcpRequest[] = [];
		let shouldExpireSession = true;
		const fetch = createSessionFetch(requests, {
			"tools/call": (id, params) => {
				if (params?.name !== "streamdeck__get_executable_actions") {
					return jsonRpcErrorResponse(id, -32601, "missing");
				}

				if (shouldExpireSession) {
					shouldExpireSession = false;
					return jsonRpcErrorResponse(null, -32001, "Session expired.", 404);
				}

				return jsonRpcResponse(id, {
					content: [
						{
							text: JSON.stringify({
								actions: [
									{
										description: {
											description: "Turns the studio lights on.",
											name: "Lights On",
										},
										id: "runtime-action-id",
									},
								],
							}),
							type: "text",
						},
					],
				});
			},
		});
		const client = createMcpClient({ fetch, url: "http://localhost:9090/mcp" });

		await expect(client.listActions()).resolves.toEqual([
			{
				description: "Turns the studio lights on.",
				id: "runtime-action-id",
				name: "Lights On",
			},
		]);

		expect(requests.map((request) => request.method)).toEqual([
			"initialize",
			"notifications/initialized",
			"tools/call",
			"initialize",
			"notifications/initialized",
			"tools/call",
		]);
	});

	it("does not retry auth failures as session expiry", async () => {
		const requests: RecordedMcpRequest[] = [];
		const fetch = createSessionFetch(requests, {
			"tools/call": (_id, params) =>
				params?.name === "streamdeck__get_executable_actions"
					? jsonRpcErrorResponse(null, -32003, "Forbidden.", 403)
					: jsonRpcErrorResponse(null, -32601, "missing"),
		});
		const client = createMcpClient({ fetch, url: "http://localhost:9090/mcp" });

		await expect(client.listActions()).rejects.toThrow("Forbidden.");
		expect(requests.map((request) => request.method)).toEqual([
			"initialize",
			"notifications/initialized",
			"tools/call",
		]);
	});
});

type JsonRpcRequestBody = {
	id?: number;
	method?: string;
	params?: unknown;
};

type RecordedMcpRequest = {
	body: JsonRpcRequestBody;
	method: string | undefined;
	protocolVersion: string | null;
	sessionId: string | null;
};

type MethodResponses = Record<
	string,
	(id: number | undefined, params?: { arguments?: unknown; name?: string }) => Response
>;

function createSessionFetch(records: RecordedMcpRequest[], responses: MethodResponses): typeof fetch {
	return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
		if (init?.method === "GET") {
			return new Response(null, { status: 405 });
		}

		const headers = new Headers(init?.headers);
		const body = JSON.parse(String(init?.body ?? "{}")) as JsonRpcRequestBody;
		const sessionId = headers.get("mcp-session-id");
		records.push({
			body,
			method: body.method,
			protocolVersion: headers.get("mcp-protocol-version"),
			sessionId,
		});

		if (body.method === "initialize") {
			return jsonRpcResponse(
				body.id,
				{
					capabilities: { tools: {} },
					protocolVersion: MCP_PROTOCOL_VERSION,
					serverInfo: { name: "elgato-mcp", version: "0.0.0" },
				},
				{ "mcp-session-id": "control-mesh-session" },
			);
		}

		if (body.method === "notifications/initialized") {
			return new Response(null, { status: 202 });
		}

		if (!sessionId) {
			return jsonRpcErrorResponse(null, -32000, "Bad Request: No valid session ID provided.", 400);
		}

		return (
			responses[body.method ?? ""]?.(body.id, body.params as { arguments?: unknown; name?: string } | undefined) ??
			jsonRpcErrorResponse(body.id, -32601, "missing")
		);
	}) as typeof fetch;
}

function jsonRpcResponse(id: number | undefined, result: unknown, headers?: Record<string, string>): Response {
	return new Response(JSON.stringify({ id, jsonrpc: "2.0", result }), {
		headers: { "content-type": "application/json", ...headers },
		status: 200,
	});
}

function jsonRpcErrorResponse(id: number | null | undefined, code: number, message: string, status = 200): Response {
	return new Response(JSON.stringify({ error: { code, message }, id, jsonrpc: "2.0" }), {
		headers: { "content-type": "application/json" },
		status,
	});
}
