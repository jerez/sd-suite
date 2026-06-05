import type { ControlMeshSettings } from "../settings/control-mesh-settings";
import { parseExecuteRemoteActionSettings } from "../actions/execute-remote-action-settings";

export type ValidationResult = { error: string; ok: false } | { ok: true };

export type ActionFormInput = {
	actionId?: string;
	targetNodeId?: string;
};

/**
 * Validates per-button remote action settings before persisting them through the property inspector.
 */
export function validateActionForm(input: ActionFormInput): ValidationResult {
	const result = parseExecuteRemoteActionSettings(input);

	if (!result.ok) {
		return { error: result.error, ok: false };
	}

	return { ok: true };
}

/**
 * Removes one known peer and its trust link without modifying unrelated peers.
 */
export function removeKnownPeer(settings: ControlMeshSettings, remoteNodeId: string): ControlMeshSettings {
	return {
		...settings,
		knownPeers: settings.knownPeers.filter((peer) => peer.nodeId !== remoteNodeId),
		trustLinks: settings.trustLinks.filter((link) => link.remoteNodeId !== remoteNodeId),
	};
}
