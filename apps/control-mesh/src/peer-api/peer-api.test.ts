import { afterEach, describe, expect, it } from "vitest";

import { createPeerClient } from "./peer-client";
import { createPeerServer } from "./peer-server";
import { createPairingClient } from "./pairing-client";

const servers: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
	await Promise.all(servers.map((server) => server.close()));
	servers.length = 0;
});

describe("peer api", () => {
	it("serves authenticated health and validates node identity", async () => {
		const server = createPeerServer({
			executeAction: async () => ({ ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			resolveSecret: (nodeId) => (nodeId === "node-a" ? "shared-secret" : undefined),
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const client = createPeerClient({
			localNodeId: "node-a",
			secret: "shared-secret",
			url,
		});

		await expect(client.health()).resolves.toMatchObject({
			executor: { enabled: true, mcpHealthy: true },
			node: { nodeId: "node-b", nodeName: "Studio" },
			version: "0.1.0",
		});
	});

	it("rejects unsigned action list requests", async () => {
		const server = createPeerServer({
			executeAction: async () => ({ ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			resolveSecret: () => undefined,
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const response = await fetch(`${url}/actions`);

		expect(response.status).toBe(401);
	});

	it("serves unauthenticated live pairing requests through the approval handler", async () => {
		const server = createPeerServer({
			executeAction: async () => ({ ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			requestPairing: async (request) =>
				request.node.nodeId === "node-a"
					? {
							endpoint: "http://studio.local:38765",
							node: { nodeId: "node-b", nodeName: "Studio" },
							ok: true,
							sharedSecret: "generated-secret",
						}
					: { error: "Pairing rejected.", ok: false },
			resolveSecret: () => undefined,
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const response = await createPairingClient({ url }).requestPairing({
			endpoint: "http://node-a.local:38765",
			executorEnabled: true,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});

		expect(response).toEqual({
			endpoint: "http://studio.local:38765",
			node: { nodeId: "node-b", nodeName: "Studio" },
			ok: true,
			sharedSecret: "generated-secret",
		});
	});

	it("rejects pairing when no live approval handler is available", async () => {
		const server = createPeerServer({
			executeAction: async () => ({ ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			resolveSecret: () => undefined,
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const response = await fetch(`${url}/pair`, {
			body: JSON.stringify({
				endpoint: "http://node-a.local:38765",
				node: { nodeId: "node-a", nodeName: "Desk" },
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: "Pairing approval is not available.",
			ok: false,
		});
	});

	it("lists MCP actions for an authenticated peer", async () => {
		const server = createPeerServer({
			executeAction: async () => ({ ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [
				{
					description: "Turns the studio lights on.",
					id: "runtime-action-id",
					name: "Website",
					title: "Juanna Ink",
				},
			],
			resolveSecret: (nodeId) => (nodeId === "node-a" ? "shared-secret" : undefined),
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const client = createPeerClient({
			localNodeId: "node-a",
			secret: "shared-secret",
			url,
		});

		await expect(client.listActions()).resolves.toEqual([
			{
				description: "Turns the studio lights on.",
				id: "runtime-action-id",
				name: "Website",
				title: "Juanna Ink",
			},
		]);
	});

	it("executes MCP actions for an authenticated peer", async () => {
		const server = createPeerServer({
			executeAction: async (actionId) => ({ actionId, ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			resolveSecret: (nodeId) => (nodeId === "node-a" ? "shared-secret" : undefined),
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const client = createPeerClient({
			localNodeId: "node-a",
			secret: "shared-secret",
			url,
		});

		await expect(client.execute("lights.on")).resolves.toEqual({
			ok: true,
			result: { actionId: "lights.on", ok: true },
		});
	});

	it("rotates a trust link for an authenticated peer", async () => {
		let rotatedSecret = "";
		const server = createPeerServer({
			executeAction: async () => ({ ok: true }),
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: true }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			resolveSecret: (nodeId) => (nodeId === "node-a" ? "old-secret" : undefined),
			rotateSecret: async (nodeId, sharedSecret) => {
				rotatedSecret = `${nodeId}:${sharedSecret}`;
			},
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const client = createPeerClient({
			localNodeId: "node-a",
			secret: "old-secret",
			url,
		});

		await expect(client.rotateSecret("new-secret")).resolves.toEqual({ ok: true });
		expect(rotatedSecret).toBe("node-a:new-secret");
	});

	it("returns structured errors for injected execution failures", async () => {
		const server = createPeerServer({
			executeAction: async () => {
				throw new Error("MCP unavailable");
			},
			getExecutorStatus: async () => ({ enabled: true, mcpHealthy: false }),
			getLocalNode: () => ({ nodeId: "node-b", nodeName: "Studio" }),
			listActions: async () => [],
			resolveSecret: (nodeId) => (nodeId === "node-a" ? "shared-secret" : undefined),
		});
		servers.push(server);
		const { url } = await server.listen({ host: "localhost", port: 0 });

		const client = createPeerClient({
			localNodeId: "node-a",
			secret: "shared-secret",
			url,
		});

		await expect(client.execute("lights.on")).resolves.toEqual({
			error: "MCP unavailable",
			ok: false,
		});
	});
});
