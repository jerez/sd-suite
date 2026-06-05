/**
 * Raw Stream Deck action settings persisted for one Execute Remote Action key.
 */
export type ExecuteRemoteActionSettings = {
	actionId?: string;
	actionLabel?: string;
	targetNodeId?: string;
	targetNodeLabel?: string;
};

/**
 * Validated settings ready for remote peer execution.
 */
export type ParsedExecuteRemoteActionSettings = {
	actionId: string;
	targetNodeId: string;
};

export type SettingsParseResult = { ok: true; value: ParsedExecuteRemoteActionSettings } | { error: string; ok: false };

/**
 * Validates action settings for remote execution.
 */
export function parseExecuteRemoteActionSettings(settings: ExecuteRemoteActionSettings): SettingsParseResult {
	const targetNodeId = settings.targetNodeId?.trim();
	if (!targetNodeId) {
		return { error: "Target peer is required.", ok: false };
	}

	const actionId = settings.actionId?.trim();
	if (!actionId) {
		return { error: "Remote action is required.", ok: false };
	}

	return {
		ok: true,
		value: {
			actionId,
			targetNodeId,
		},
	};
}
