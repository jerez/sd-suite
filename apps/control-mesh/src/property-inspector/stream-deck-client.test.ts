import { afterEach, describe, expect, it, vi } from "vitest";

import { getStreamDeckClient } from "./stream-deck-client";

describe("getStreamDeckClient", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("sends plugin messages through the official SDPI client protocol", async () => {
		const send = vi.fn();
		const sdpiClient = {
			getGlobalSettings: vi.fn(async () => ({ localNode: { nodeId: "local-node" } })),
			getSettings: vi.fn(async () => ({ settings: { targetNodeId: "studio" } })),
			send,
			sendToPropertyInspector: {
				subscribe: vi.fn(),
				unsubscribe: vi.fn(),
			},
			setGlobalSettings: vi.fn(async () => undefined),
			setSettings: vi.fn(async () => undefined),
		};

		vi.stubGlobal("window", {
			SDPIComponents: { streamDeckClient: sdpiClient },
		});

		const client = getStreamDeckClient();
		await client?.sendToPlugin({ type: "testLocalMcp" });

		expect(client).toBeDefined();
		expect(send).toHaveBeenCalledWith("sendToPlugin", { type: "testLocalMcp" });
	});

	it("normalizes global settings envelopes from the SDPI client", async () => {
		const sdpiClient = {
			getGlobalSettings: vi.fn(async () => ({
				settings: { executor: { enabled: true }, localNode: { nodeId: "local-node" } },
			})),
			getSettings: vi.fn(async () => ({})),
			send: vi.fn(),
			sendToPropertyInspector: {
				subscribe: vi.fn(),
				unsubscribe: vi.fn(),
			},
			setGlobalSettings: vi.fn(async () => undefined),
			setSettings: vi.fn(async () => undefined),
		};

		vi.stubGlobal("window", {
			SDPIComponents: { streamDeckClient: sdpiClient },
		});

		const client = getStreamDeckClient();

		await expect(client?.getGlobalSettings()).resolves.toEqual({
			executor: { enabled: true },
			localNode: { nodeId: "local-node" },
		});
	});

	it("returns undefined when SDPI Components are unavailable", () => {
		vi.stubGlobal("window", {});

		const client = getStreamDeckClient();

		expect(client).toBeUndefined();
	});

	it("normalizes sendToPropertyInspector payloads that include event envelopes", () => {
		const sdpiClient = {
			getGlobalSettings: vi.fn(async () => ({})),
			getSettings: vi.fn(async () => ({})),
			send: vi.fn(),
			sendToPropertyInspector: {
				subscribe: vi.fn(),
				unsubscribe: vi.fn(),
			},
			setGlobalSettings: vi.fn(async () => undefined),
			setSettings: vi.fn(async () => undefined),
		};
		const onPluginMessage = vi.fn();
		let listener: (event: unknown) => void = vi.fn();

		vi.stubGlobal("window", {
			SDPIComponents: { streamDeckClient: sdpiClient },
		});

		sdpiClient.sendToPropertyInspector.subscribe.mockImplementation((value: (event: unknown) => void) => {
			listener = value;
		});

		const client = getStreamDeckClient();
		const message = { type: "refreshDiscoveryResult", ok: true, discoveredPeers: [] };
		client?.onPluginMessage(onPluginMessage);
		listener({ payload: message });

		expect(onPluginMessage).toHaveBeenCalledWith(message);
	});

	it("normalizes raw sendToPropertyInspector payloads", () => {
		const sdpiClient = {
			getGlobalSettings: vi.fn(async () => ({})),
			getSettings: vi.fn(async () => ({})),
			send: vi.fn(),
			sendToPropertyInspector: {
				subscribe: vi.fn(),
				unsubscribe: vi.fn(),
			},
			setGlobalSettings: vi.fn(async () => undefined),
			setSettings: vi.fn(async () => undefined),
		};
		const onPluginMessage = vi.fn();
		let listener: (event: unknown) => void = vi.fn();

		vi.stubGlobal("window", {
			SDPIComponents: { streamDeckClient: sdpiClient },
		});

		sdpiClient.sendToPropertyInspector.subscribe.mockImplementation((value: (event: unknown) => void) => {
			listener = value;
		});

		const client = getStreamDeckClient();
		const message = { type: "testPeerConnectionResult", ok: false, remoteNodeId: "peer", error: "oops" };
		client?.onPluginMessage(onPluginMessage);
		listener(message);

		expect(onPluginMessage).toHaveBeenCalledWith(message);
	});
});
