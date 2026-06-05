import { describe, expect, it, vi } from "vitest";

import { createBonjourDiscoveryAdapter } from "./bonjour-discovery";
import { createDiscoveryService } from "./discovery-service";

describe("createDiscoveryService", () => {
	it("tracks discovered peers without trusting them", async () => {
		const onPeer = vi.fn();
		const adapter = {
			startAdvertising: vi.fn(),
			startBrowsing: vi.fn((handler: Parameters<typeof createDiscoveryService>[0]["onPeer"]) => {
				handler({
					discoveredAt: "2026-06-02T00:00:00.000Z",
					endpoint: "http://studio.local:38765",
					executorEnabled: true,
					nodeId: "studio",
					nodeName: "Studio",
					version: "0.1.0",
				});
			}),
			stop: vi.fn(),
		};

		const service = createDiscoveryService({
			adapter,
			onPeer,
		});

		await service.startBrowsing();

		expect(onPeer).toHaveBeenCalledWith(
			expect.objectContaining({
				endpoint: "http://studio.local:38765",
				nodeId: "studio",
			}),
		);
		expect(adapter.startBrowsing).toHaveBeenCalledTimes(1);
	});
});

describe("createBonjourDiscoveryAdapter", () => {
	it("advertises Control Mesh metadata as Bonjour TXT fields", async () => {
		const publishedService = { stop: vi.fn((callback?: CallableFunction) => callback?.()) };
		const bonjour = {
			destroy: vi.fn((callback?: CallableFunction) => callback?.()),
			find: vi.fn(),
			publish: vi.fn(() => publishedService),
		};
		const adapter = createBonjourDiscoveryAdapter({ bonjour });

		await adapter.startAdvertising({
			endpoint: "http://studio.local:38765",
			executorEnabled: true,
			nodeId: "studio",
			nodeName: "Studio",
			version: "0.1.0",
		});

		expect(bonjour.publish).toHaveBeenCalledWith({
			name: "Control Mesh Studio",
			port: 38765,
			protocol: "tcp",
			txt: {
				endpoint: "http://studio.local:38765",
				executorEnabled: "true",
				nodeId: "studio",
				nodeName: "Studio",
				version: "0.1.0",
			},
			type: "control-mesh",
		});
	});

	it("converts Bonjour TXT records into discovered peers", async () => {
		const onPeer = vi.fn();
		const bonjour = {
			destroy: vi.fn((callback?: CallableFunction) => callback?.()),
			find: vi.fn((_options: unknown, onup: (service: { port: number; txt: Record<string, string> }) => void) => {
				onup({
					port: 38765,
					txt: {
						endpoint: "http://studio.local:38765",
						executorEnabled: "true",
						nodeId: "studio",
						nodeName: "Studio",
						version: "0.1.0",
					},
				});
				return { stop: vi.fn() };
			}),
			publish: vi.fn(),
		};
		const adapter = createBonjourDiscoveryAdapter({
			bonjour,
			now: () => new Date("2026-06-02T00:00:00.000Z"),
		});

		await adapter.startBrowsing(onPeer);

		expect(onPeer).toHaveBeenCalledWith({
			discoveredAt: "2026-06-02T00:00:00.000Z",
			endpoint: "http://studio.local:38765",
			executorEnabled: true,
			nodeId: "studio",
			nodeName: "Studio",
			version: "0.1.0",
		});
	});
});
