import streamDeck, { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";

import { type ControlMeshSettings, normalizeControlMeshSettings } from "../settings/control-mesh-settings";
import { createPeerClient, type PeerClient, type PeerClientOptions } from "../peer-api/peer-client";
import type { ExecuteRemoteActionResponse, RemoteActionMetadata } from "../peer-api/peer-api-types";
import type { PeerConnection, PluginRuntime } from "../plugin-runtime";

import { type ExecuteRemoteActionSettings, parseExecuteRemoteActionSettings } from "./execute-remote-action-settings";

type DataSourceItem = {
	disabled?: boolean;
	label?: string;
	value: string;
};

type ExecuteRemoteActionPropertyInspectorMessage =
	| { event: "getRemoteActions"; isRefresh?: true }
	| { event: "getTrustedPeers"; isRefresh?: true };

type ExecuteRemoteActionPropertyInspectorResult = {
	actionDescriptions?: Record<string, string>;
	event: ExecuteRemoteActionPropertyInspectorMessage["event"];
	items: DataSourceItem[];
};

type ActionImageHandle = {
	setImage(image?: string): Promise<void>;
};

type FeedbackImageController = {
	clear(action: ActionImageHandle): Promise<void>;
	showActive(action: ActionImageHandle): Promise<void>;
	showError(action: ActionImageHandle): Promise<void>;
	showSuccess(action: ActionImageHandle): Promise<void>;
};

const ACTIVE_IMAGE_PATH = "imgs/actions/execute-remote-action/key-active.svg";
const ERROR_IMAGE_PATH = "imgs/actions/execute-remote-action/key-error.svg";
const SUCCESS_IMAGE_PATH = "imgs/actions/execute-remote-action/key-success.svg";
const RESULT_IMAGE_DWELL_MS = 1_200;

/**
 * Dependencies needed to execute one configured remote action.
 */
export type ExecuteConfiguredRemoteActionDependencies = {
	createPeerClient(input: PeerClientOptions): Pick<PeerClient, "execute">;
	resolvePeerConnection(nodeId: string): PeerConnection | Promise<PeerConnection | undefined> | undefined;
};

/**
 * Dependencies used by the Execute Remote Action property inspector data sources.
 */
export type ExecuteRemoteActionPropertyInspectorDependencies = {
	createPeerClient(input: PeerClientOptions): Pick<PeerClient, "listActions">;
	getActionSettings(): ExecuteRemoteActionSettings | Promise<ExecuteRemoteActionSettings>;
	getGlobalSettings(): ControlMeshSettings | Promise<ControlMeshSettings>;
	resolvePeerConnection(nodeId: string): PeerConnection | Promise<PeerConnection | undefined> | undefined;
};

/**
 * Constructor dependencies for the Stream Deck action.
 */
export type ExecuteRemoteActionOptions = {
	createPeerClient?: typeof createPeerClient;
	createFeedbackImageController?: () => FeedbackImageController;
	runtime: Pick<PluginRuntime, "resolvePeerConnection">;
};

/**
 * Parses key settings, resolves the peer connection, and executes the remote action.
 */
export async function executeConfiguredRemoteAction(
	settings: ExecuteRemoteActionSettings,
	dependencies: ExecuteConfiguredRemoteActionDependencies,
): Promise<ExecuteRemoteActionResponse> {
	const parsedSettings = parseExecuteRemoteActionSettings(settings);
	if (!parsedSettings.ok) {
		return parsedSettings;
	}

	const connection = await dependencies.resolvePeerConnection(parsedSettings.value.targetNodeId);
	if (!connection) {
		return { error: "Peer connection is not configured.", ok: false };
	}

	try {
		const peerClient = dependencies.createPeerClient({
			localNodeId: connection.localNodeId,
			secret: connection.secret,
			url: connection.url,
		});

		return await peerClient.execute(parsedSettings.value.actionId);
	} catch (error) {
		return { error: getErrorMessage(error), ok: false };
	}
}

/**
 * Handles one Execute Remote Action property-inspector datasource request.
 */
export async function handleExecuteRemoteActionPropertyInspectorMessage(
	message: ExecuteRemoteActionPropertyInspectorMessage,
	dependencies: ExecuteRemoteActionPropertyInspectorDependencies,
): Promise<ExecuteRemoteActionPropertyInspectorResult | undefined> {
	if (message.event === "getTrustedPeers") {
		return getTrustedPeersResult(dependencies);
	}

	if (message.event === "getRemoteActions") {
		return getRemoteActionsResult(dependencies);
	}

	return undefined;
}

/**
 * Stream Deck action shell for invoking one configured remote MCP action.
 */
@action({ UUID: "dev.jerez.sds.control-mesh.execute-remote-action" })
export class ExecuteRemoteAction extends SingletonAction<ExecuteRemoteActionSettings> {
	readonly #createPeerClient: typeof createPeerClient;
	readonly #feedbackImages: FeedbackImageController;
	readonly #runtime: Pick<PluginRuntime, "resolvePeerConnection">;

	constructor(options: ExecuteRemoteActionOptions) {
		super();
		this.#createPeerClient = options.createPeerClient ?? createPeerClient;
		this.#feedbackImages = options.createFeedbackImageController?.() ?? createFeedbackImageController();
		this.#runtime = options.runtime;
	}

	/**
	 * Supplies trusted-peer and remote-action datasource items to the property inspector.
	 */
	override async onSendToPlugin(
		ev: SendToPluginEvent<ExecuteRemoteActionPropertyInspectorMessage, ExecuteRemoteActionSettings>,
	): Promise<void> {
		const result = await handleExecuteRemoteActionPropertyInspectorMessage(ev.payload, {
			createPeerClient: this.#createPeerClient,
			getActionSettings: () => ev.action.getSettings<ExecuteRemoteActionSettings>(),
			getGlobalSettings: () => streamDeck.settings.getGlobalSettings<ControlMeshSettings>(),
			resolvePeerConnection: (nodeId) => this.#runtime.resolvePeerConnection(nodeId),
		});

		if (result) {
			await streamDeck.ui.sendToPropertyInspector(result);
		}
	}

	/**
	 * Executes the configured remote action and shows Stream Deck feedback.
	 */
	override async onKeyDown(ev: KeyDownEvent<ExecuteRemoteActionSettings>): Promise<void> {
		await this.#feedbackImages.showActive(ev.action);
		const result = await executeConfiguredRemoteAction(ev.payload.settings, {
			createPeerClient: this.#createPeerClient,
			resolvePeerConnection: (nodeId) => this.#runtime.resolvePeerConnection(nodeId),
		});

		if (!result.ok) {
			streamDeck.logger.warn(`Execute Remote Action failed: ${result.error}`);
			await this.#feedbackImages.showError(ev.action);
			await ev.action.showAlert();
			return;
		}

		await this.#feedbackImages.showSuccess(ev.action);
	}
}

async function getTrustedPeersResult(
	dependencies: ExecuteRemoteActionPropertyInspectorDependencies,
): Promise<ExecuteRemoteActionPropertyInspectorResult> {
	const settings = normalizeControlMeshSettings(await dependencies.getGlobalSettings());
	const items = settings.knownPeers
		.filter((peer) => hasTrustedPeerConnection(settings, peer.nodeId))
		.map((peer) => ({
			label: peer.displayName,
			value: peer.nodeId,
		}))
		.sort((left, right) => (left.label ?? left.value).localeCompare(right.label ?? right.value));

	return {
		event: "getTrustedPeers",
		items: items.length > 0 ? items : [createDisabledItem("No trusted peers. Pair one in Control Mesh Setup.")],
	};
}

async function getRemoteActionsResult(
	dependencies: ExecuteRemoteActionPropertyInspectorDependencies,
): Promise<ExecuteRemoteActionPropertyInspectorResult> {
	const actionSettings = await dependencies.getActionSettings();
	const targetNodeId = actionSettings.targetNodeId?.trim();

	if (!targetNodeId) {
		return {
			event: "getRemoteActions",
			items: [createDisabledItem("Select a trusted peer first.")],
		};
	}

	const globalSettings = normalizeControlMeshSettings(await dependencies.getGlobalSettings());
	const peerDisplayName = globalSettings.knownPeers.find((peer) => peer.nodeId === targetNodeId)?.displayName?.trim();
	const connection = await dependencies.resolvePeerConnection(targetNodeId);
	if (!connection) {
		return {
			event: "getRemoteActions",
			items: [createDisabledItem("Peer connection is not configured.")],
		};
	}

	try {
		const actions = await dependencies
			.createPeerClient({
				localNodeId: connection.localNodeId,
				secret: connection.secret,
				url: connection.url,
			})
			.listActions();
		const actionDescriptions = Object.fromEntries(
			actions.map((remoteAction) => [remoteAction.id, formatRemoteActionDescription(peerDisplayName, remoteAction)]),
		);
		const items = actions
			.map((remoteAction) => ({
				label: formatRemoteActionLabel(peerDisplayName, remoteAction),
				value: remoteAction.id,
			}))
			.sort((left, right) => (left.label ?? left.value).localeCompare(right.label ?? right.value));

		return {
			actionDescriptions,
			event: "getRemoteActions",
			items: items.length > 0 ? items : [createDisabledItem("No remote actions available.")],
		};
	} catch (error) {
		return {
			event: "getRemoteActions",
			items: [createDisabledItem(`Remote actions unavailable: ${getErrorMessage(error)}`)],
		};
	}
}

function hasTrustedPeerConnection(settings: ControlMeshSettings, remoteNodeId: string): boolean {
	const knownPeer = settings.knownPeers.find((peer) => peer.nodeId === remoteNodeId);
	const trustLink = settings.trustLinks.find((link) => link.enabled && link.remoteNodeId === remoteNodeId);

	return Boolean(knownPeer?.endpoints[0] && trustLink?.sharedSecret);
}

function formatRemoteActionLabel(peerDisplayName: string | undefined, remoteAction: RemoteActionMetadata): string {
	const actionSummary = remoteAction.title?.trim() || remoteAction.name.trim();
	const peerPrefix = peerDisplayName ? `${peerDisplayName}: ` : "";

	return `${peerPrefix}${actionSummary}`;
}

function formatRemoteActionDescription(
	peerDisplayName: string | undefined,
	remoteAction: RemoteActionMetadata,
): string {
	const actionSummary = remoteAction.description?.trim() || remoteAction.title?.trim() || remoteAction.name.trim();
	const peerPrefix = peerDisplayName ? `${peerDisplayName}: ` : "";

	return `${peerPrefix}${actionSummary}`;
}

function createDisabledItem(label: string): DataSourceItem {
	return { disabled: true, label, value: "" };
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Remote action execution failed.";
}

function createFeedbackImageController(): FeedbackImageController {
	const restoreTimers = new WeakMap<ActionImageHandle, ReturnType<typeof setTimeout>>();

	return {
		async clear(action) {
			clearRestore(action);
			await action.setImage(undefined);
		},
		async showActive(action) {
			clearRestore(action);
			await action.setImage(ACTIVE_IMAGE_PATH);
		},
		async showError(action) {
			await showResult(action, ERROR_IMAGE_PATH);
		},
		async showSuccess(action) {
			await showResult(action, SUCCESS_IMAGE_PATH);
		},
	};

	async function showResult(action: ActionImageHandle, imagePath: string): Promise<void> {
		clearRestore(action);
		await action.setImage(imagePath);
		restoreTimers.set(
			action,
			setTimeout(() => {
				restoreTimers.delete(action);
				void action.setImage(undefined);
			}, RESULT_IMAGE_DWELL_MS),
		);
	}

	function clearRestore(action: ActionImageHandle): void {
		const timer = restoreTimers.get(action);
		if (!timer) {
			return;
		}

		clearTimeout(timer);
		restoreTimers.delete(action);
	}
}
