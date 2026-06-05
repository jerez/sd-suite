import type { LocalNode } from "../settings/control-mesh-settings";

/**
 * Peer identity sent by an untrusted node requesting explicit local approval.
 */
export type PairingRequest = {
	endpoint: string;
	executorEnabled: boolean;
	node: LocalNode;
};

/**
 * Response returned by the accepting node after the local user approves or rejects pairing.
 */
export type PairingResponse =
	| {
			endpoint: string;
			node: LocalNode;
			ok: true;
			sharedSecret: string;
	  }
	| {
			error: string;
			ok: false;
	  };
