import Bonjour from "bonjour-service";

import type { DiscoveredPeer, DiscoveryAdvertisement } from "./discovery-types";
import type { DiscoveryAdapter } from "./discovery-service";

const BONJOUR_SERVICE_TYPE = "control-mesh";
const BONJOUR_PROTOCOL = "tcp";

type BonjourServiceRecord = {
	host?: string;
	port: number;
	txt?: Record<string, unknown>;
};

type BonjourBrowser = {
	stop(): void;
};

type BonjourPublishedService = {
	stop: CallableFunction;
};

type BonjourLike = {
	destroy(callback?: CallableFunction): void;
	find(
		options: { protocol: typeof BONJOUR_PROTOCOL; type: typeof BONJOUR_SERVICE_TYPE },
		onup: (service: BonjourServiceRecord) => void,
	): BonjourBrowser;
	publish(options: {
		name: string;
		port: number;
		protocol: typeof BONJOUR_PROTOCOL;
		txt: Record<string, string>;
		type: typeof BONJOUR_SERVICE_TYPE;
	}): BonjourPublishedService;
};

/**
 * Optional dependencies for the Bonjour discovery adapter.
 */
export type BonjourDiscoveryOptions = {
	bonjour?: BonjourLike;
	now?: () => Date;
};

/**
 * Creates an mDNS/Bonjour discovery adapter for Control Mesh candidate peers.
 */
export function createBonjourDiscoveryAdapter(input: BonjourDiscoveryOptions = {}): DiscoveryAdapter {
	const bonjour = input.bonjour ?? (new Bonjour() as unknown as BonjourLike);
	const now = input.now ?? (() => new Date());
	const ownsBonjour = !input.bonjour;
	let browser: BonjourBrowser | undefined;
	let publishedService: BonjourPublishedService | undefined;

	return {
		async startAdvertising(advertisement) {
			await stopPublishedService(publishedService);
			publishedService = bonjour.publish({
				name: `Control Mesh ${advertisement.nodeName}`,
				port: getEndpointPort(advertisement.endpoint),
				protocol: BONJOUR_PROTOCOL,
				txt: toTxtRecord(advertisement),
				type: BONJOUR_SERVICE_TYPE,
			});
		},
		startBrowsing(onPeer) {
			browser?.stop();
			browser = bonjour.find({ protocol: BONJOUR_PROTOCOL, type: BONJOUR_SERVICE_TYPE }, (service) => {
				const peer = toDiscoveredPeer(service, now);
				if (peer) {
					onPeer(peer);
				}
			});
		},
		async stop() {
			browser?.stop();
			browser = undefined;
			await stopPublishedService(publishedService);
			publishedService = undefined;

			if (ownsBonjour) {
				await destroyBonjour(bonjour);
			}
		},
	};
}

function toTxtRecord(advertisement: DiscoveryAdvertisement): Record<string, string> {
	return {
		endpoint: advertisement.endpoint,
		executorEnabled: advertisement.executorEnabled ? "true" : "false",
		nodeId: advertisement.nodeId,
		nodeName: advertisement.nodeName,
		version: advertisement.version,
	};
}

function toDiscoveredPeer(service: BonjourServiceRecord, now: () => Date): DiscoveredPeer | undefined {
	const endpoint = getTxtValue(service.txt, "endpoint");
	const nodeId = getTxtValue(service.txt, "nodeId");

	if (!endpoint || !nodeId) {
		return undefined;
	}

	return {
		discoveredAt: now().toISOString(),
		endpoint,
		executorEnabled: getTxtValue(service.txt, "executorEnabled") === "true",
		nodeId,
		nodeName: getTxtValue(service.txt, "nodeName") ?? nodeId,
		version: getTxtValue(service.txt, "version") ?? "unknown",
	};
}

function getTxtValue(txt: Record<string, unknown> | undefined, key: string): string | undefined {
	const value = txt?.[key];
	if (typeof value === "string") {
		return value;
	}

	if (Buffer.isBuffer(value)) {
		return value.toString("utf8");
	}

	return undefined;
}

function getEndpointPort(endpoint: string): number {
	const url = new URL(endpoint);
	const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));

	if (!Number.isInteger(port) || port <= 0) {
		throw new Error(`Discovery endpoint does not include a valid port: ${endpoint}`);
	}

	return port;
}

function stopPublishedService(service: BonjourPublishedService | undefined): Promise<void> {
	if (!service) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		service.stop(resolve);
	});
}

function destroyBonjour(bonjour: BonjourLike): Promise<void> {
	return new Promise((resolve) => {
		bonjour.destroy(resolve);
	});
}
