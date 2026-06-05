import type { DiscoveredPeer, DiscoveryAdvertisement } from "./discovery-types";

/**
 * Callback invoked for each discovered candidate peer.
 */
export type DiscoveredPeerHandler = (peer: DiscoveredPeer) => void;

/**
 * Adapter contract for a concrete discovery transport such as Bonjour.
 */
export type DiscoveryAdapter = {
	/**
	 * Advertises the local node as a candidate executor.
	 */
	startAdvertising(advertisement: DiscoveryAdvertisement): Promise<void> | void;
	/**
	 * Starts browsing for candidate peers.
	 */
	startBrowsing(onPeer: DiscoveredPeerHandler): Promise<void> | void;
	/**
	 * Stops any active advertising and browsing resources.
	 */
	stop(): Promise<void> | void;
};

/**
 * Discovery service lifecycle used by the plugin runtime.
 */
export type DiscoveryService = {
	/**
	 * Advertises local executor metadata.
	 */
	startAdvertising(advertisement: DiscoveryAdvertisement): Promise<void>;
	/**
	 * Starts browsing for candidate peers without trusting them.
	 */
	startBrowsing(): Promise<void>;
	/**
	 * Stops all active discovery resources.
	 */
	stop(): Promise<void>;
};

/**
 * Creates a transport-agnostic discovery service.
 */
export function createDiscoveryService(input: {
	adapter: DiscoveryAdapter;
	onPeer: DiscoveredPeerHandler;
}): DiscoveryService {
	return {
		async startAdvertising(advertisement) {
			await input.adapter.startAdvertising(advertisement);
		},
		async startBrowsing() {
			await input.adapter.startBrowsing(input.onPeer);
		},
		async stop() {
			await input.adapter.stop();
		},
	};
}
