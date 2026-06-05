import type { PairingRequest, PairingResponse } from "./pairing-types";

/**
 * Configuration for requesting pairing from one discovered Control Mesh node.
 */
export type PairingClientOptions = {
	fetch?: typeof fetch;
	url: string;
};

/**
 * Client for the unauthenticated, approval-gated pairing endpoint.
 */
export type PairingClient = {
	/**
	 * Requests pairing from a discovered peer and waits for local approval on that peer.
	 */
	requestPairing(request: PairingRequest): Promise<PairingResponse>;
};

/**
 * Creates a client for requesting one live pairing approval.
 */
export function createPairingClient(input: PairingClientOptions): PairingClient {
	const fetchImpl = input.fetch ?? fetch;

	return {
		async requestPairing(request) {
			const response = await fetchImpl(new URL("/pair", input.url), {
				body: JSON.stringify(request),
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST",
			});

			return (await response.json()) as PairingResponse;
		},
	};
}
