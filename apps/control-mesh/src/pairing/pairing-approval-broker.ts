import type { PairingApprovalResult } from "../plugin-runtime";
import type { PairingRequest } from "../peer-api/pairing-types";

export type PairingApprovalMessage = {
	endpoint: string;
	nodeId: string;
	nodeName: string;
	requestId: string;
	type: "pairingRequestReceived";
};

/**
 * Live bridge between incoming pairing HTTP requests and the visible setup property inspector.
 */
export type PairingApprovalBroker = {
	/**
	 * Approves one in-flight pairing request from the property inspector.
	 */
	approve(requestId: string): void;
	/**
	 * Rejects one in-flight pairing request from the property inspector.
	 */
	reject(requestId: string): void;
	/**
	 * Requests local user approval through the visible setup property inspector.
	 */
	requestApproval(request: PairingRequest): Promise<PairingApprovalResult>;
	/**
	 * Records whether the setup property inspector can currently receive approval requests.
	 */
	setVisible(visible: boolean): void;
};

export type PairingApprovalBrokerOptions = {
	sendToPropertyInspector(message: PairingApprovalMessage): Promise<void> | void;
	timeoutMs?: number;
};

const DEFAULT_PAIRING_APPROVAL_TIMEOUT_MS = 60_000;

/**
 * Creates the in-memory live approval broker for incoming pairing requests.
 */
export function createPairingApprovalBroker(options: PairingApprovalBrokerOptions): PairingApprovalBroker {
	const timeoutMs = options.timeoutMs ?? DEFAULT_PAIRING_APPROVAL_TIMEOUT_MS;
	const pendingRequests = new Map<
		string,
		{
			resolve(result: PairingApprovalResult): void;
			timeout: ReturnType<typeof setTimeout>;
		}
	>();
	let visible = false;

	return {
		approve(requestId) {
			resolvePendingRequest(pendingRequests, requestId, { ok: true });
		},
		reject(requestId) {
			resolvePendingRequest(pendingRequests, requestId, { error: "Pairing rejected.", ok: false });
		},
		async requestApproval(request) {
			if (!visible) {
				return { error: "Open Control Mesh Setup on this peer to approve pairing.", ok: false };
			}

			const requestId = crypto.randomUUID();
			const approval = new Promise<PairingApprovalResult>((resolve) => {
				const timeout = setTimeout(() => {
					resolvePendingRequest(pendingRequests, requestId, { error: "Pairing approval timed out.", ok: false });
				}, timeoutMs);

				pendingRequests.set(requestId, { resolve, timeout });
			});

			await options.sendToPropertyInspector({
				endpoint: request.endpoint,
				nodeId: request.node.nodeId,
				nodeName: request.node.nodeName,
				requestId,
				type: "pairingRequestReceived",
			});

			return approval;
		},
		setVisible(nextVisible) {
			visible = nextVisible;
			if (!visible) {
				for (const requestId of pendingRequests.keys()) {
					resolvePendingRequest(pendingRequests, requestId, {
						error: "Control Mesh Setup closed before pairing was approved.",
						ok: false,
					});
				}
			}
		},
	};
}

function resolvePendingRequest(
	pendingRequests: Map<
		string,
		{ resolve(result: PairingApprovalResult): void; timeout: ReturnType<typeof setTimeout> }
	>,
	requestId: string,
	result: PairingApprovalResult,
): void {
	const pendingRequest = pendingRequests.get(requestId);
	if (!pendingRequest) {
		return;
	}

	clearTimeout(pendingRequest.timeout);
	pendingRequests.delete(requestId);
	pendingRequest.resolve(result);
}
