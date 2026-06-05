import type { LocalNode } from "../settings/control-mesh-settings";

/**
 * Executor health and identity returned by a trusted Control Mesh peer.
 */
export type PeerHealthResponse = {
	executor: PeerExecutorStatus;
	node: LocalNode;
	version: string;
};

/**
 * Public executor status exposed by the peer health endpoint.
 */
export type PeerExecutorStatus = {
	enabled: boolean;
	mcpHealthy: boolean;
};

/**
 * Action metadata exposed through the peer API after mapping official MCP tools.
 */
export type RemoteActionMetadata = {
	description?: string;
	id: string;
	name: string;
	title?: string;
};

/**
 * Structured result for remote action execution.
 */
export type ExecuteRemoteActionResponse = { ok: true; result: unknown } | { error: string; ok: false };
