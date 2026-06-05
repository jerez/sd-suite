/**
 * Candidate peer found through local-network discovery.
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
 * Local node metadata advertised through mDNS/Bonjour.
 */
export type DiscoveryAdvertisement = {
	endpoint: string;
	executorEnabled: boolean;
	nodeId: string;
	nodeName: string;
	version: string;
};
