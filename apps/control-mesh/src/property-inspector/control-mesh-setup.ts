import {
	type ControlMeshSettings,
	type KnownPeer,
	mergeTrustedDiscoveredPeerEndpoints,
	normalizeControlMeshSettings,
} from "../settings/control-mesh-settings";

import { removeKnownPeer } from "./forms";
import { getStreamDeckClient, type StreamDeckClient } from "./stream-deck-client";
import type { DiscoveredPeer } from "../discovery/discovery-types";

type SdpiElement = HTMLElement & {
	checked?: boolean;
	value?: string | boolean | number;
};

const SETUP_HELP_TEXT =
	"Expose actions advertises this node on the local network and allows trusted peers to call local MCP actions.\n" +
	"Executor nodes: enable Expose actions and run the official Elgato MCP server. Caller nodes: discover, pair,\n" +
	"test, then assign Execute Remote Action. Use Control Mesh only on trusted local networks.";

type SetupElements = {
	advertisedUrl: SdpiElement;
	approvePairingButton: HTMLElement;
	discoveryPeersResult: SdpiElement;
	discoveryPeersResultItem: HTMLElement;
	executorEnabled: SdpiElement;
	executorResults: HTMLElement[];
	executorSettings: HTMLElement[];
	discoverPeersButton: HTMLElement;
	incomingPairingItem: HTMLElement;
	incomingPairingMessage: SdpiElement;
	knownPeerEndpoint: SdpiElement;
	knownPeerName: SdpiElement;
	knownPeerSelectorItem: HTMLElement;
	knownPeerSelector: SdpiElement;
	listenPort: SdpiElement;
	localMcpResult: SdpiElement;
	localMcpResultItem: HTMLElement;
	localMcpUrl: SdpiElement;
	localNodeName: SdpiElement;
	networkResult: SdpiElement;
	networkResultItem: HTMLElement;
	peerConnectionState: SdpiElement;
	pairPeerButton: HTMLElement;
	peerActionsItem: HTMLElement;
	peerDetails: HTMLElement[];
	peerStatusItem: HTMLElement;
	removePeerButton: HTMLElement;
	rejectPairingButton: HTMLElement;
	rotateSecretButton: HTMLElement;
	setupHelp: SdpiElement;
	setupSection: SdpiElement;
	setupPanels: HTMLElement[];
	testLocalMcpButton: HTMLElement;
	testPeerButton: HTMLElement;
	validationItem: HTMLElement | null;
	validationMessage: SdpiElement | null;
};

type SetupResultMessage =
	| { actionCount: number; ok: true; type: "testLocalMcpResult"; url: string }
	| { error: string; ok: false; type: "testLocalMcpResult"; url: string }
	| { discoveredPeers: DiscoveredPeer[]; ok: true; type: "refreshDiscoveryResult" }
	| { error: string; ok: false; type: "refreshDiscoveryResult" }
	| { ok: true; remoteNodeId: string; type: "requestPairingResult" }
	| { error: string; ok: false; remoteNodeId: string; type: "requestPairingResult" }
	| { ok: true; remoteNodeId: string; type: "pairingAccepted" }
	| { ok: true; remoteNodeId: string; type: "rotatePeerSecretResult" }
	| { error: string; ok: false; remoteNodeId: string; type: "rotatePeerSecretResult" }
	| { ok: true; type: "pairingDecisionResult" }
	| {
			endpoint: string;
			nodeId: string;
			nodeName: string;
			requestId: string;
			type: "pairingRequestReceived";
	  }
	| { ok: true; remoteNodeId: string; type: "testPeerConnectionResult" }
	| { error: string; ok: false; remoteNodeId: string; type: "testPeerConnectionResult" }
	| { listenPort: number; ok: true; type: "validateNetworkSettingsResult" }
	| { error: string; listenPort: number; ok: false; type: "validateNetworkSettingsResult" };

type PeerTestAttempt = {
	state: "pending" | "success" | "failed";
};

type IncomingPairingRequest = Extract<SetupResultMessage, { type: "pairingRequestReceived" }>;
type ConnectionResultState = "error" | "pending" | "success";
type SetupSection = "mesh" | "node";

if (typeof document !== "undefined") {
	document.addEventListener("DOMContentLoaded", () => {
		const elements = getSetupElements();
		if (!elements) {
			document.body.hidden = false;
			return;
		}

		const controller = createSetupController(elements, getStreamDeckClient());

		document.body.hidden = false;
		void controller.load();
	});
}

function createSetupController(elements: SetupElements, client: StreamDeckClient | undefined) {
	let settings = normalizeControlMeshSettings({});
	let discoveredPeers: DiscoveredPeer[] = [];
	let incomingPairingRequest: IncomingPairingRequest | undefined;
	let pendingNetworkSettings: ControlMeshSettings | undefined;
	let selectedPeerId = "";
	const peerTestAttempts = new Map<string, PeerTestAttempt>();
	let isRendering = false;
	setValue(elements.setupHelp, SETUP_HELP_TEXT);
	setValue(elements.setupSection, "node");
	showSetupSection(elements, "node");

	const persistSettings = async (nextSettings: ControlMeshSettings) => {
		const previousEndpoint = settings.executor.advertisedUrl;
		settings = nextSettings;
		render();
		if (!client) {
			showValidation(elements, "Stream Deck client is not connected.");
			return;
		}

		await client.setGlobalSettings(settings);
		if (settings.executor.enabled && previousEndpoint !== settings.executor.advertisedUrl) {
			requestDiscoveryRefresh(elements, client);
		}
	};

	client?.onPluginMessage((payload) =>
		handlePluginMessage(
			elements,
			payload,
			async (result) => {
				if (!result.ok) {
					showNetworkResult(elements, "error", result.error);
					pendingNetworkSettings = undefined;
					return;
				}

				const nextSettings = pendingNetworkSettings;
				pendingNetworkSettings = undefined;
				if (!nextSettings) {
					return;
				}

				showNetworkResult(
					elements,
					"success",
					nextSettings.executor.enabled
						? `Port ${result.listenPort} is available.`
						: "Actions are not exposed to the mesh.",
				);
				await persistSettings(nextSettings);
			},
			(result) => {
				discoveredPeers = result.ok ? result.discoveredPeers : [];
				if (result.ok) {
					settings = mergeTrustedDiscoveredPeerEndpoints(settings, result.discoveredPeers);
				}
				render();
			},
			(result) => {
				const testAttempt = peerTestAttempts.get(result.remoteNodeId);
				const attempt: PeerTestAttempt = testAttempt
					? { ...testAttempt, state: result.ok ? "success" : "failed" }
					: { state: result.ok ? "success" : "failed" };

				peerTestAttempts.set(result.remoteNodeId, attempt);
				render();
			},
			(result) => {
				if (result.ok) {
					void reloadSettingsAfterPairing(result.remoteNodeId);
					return;
				}

				showPeerConnectionResult(elements, "error", `Pairing failed: ${result.error}`);
			},
			(request) => {
				incomingPairingRequest = request;
				render();
			},
			(remoteNodeId) => {
				void reloadSettingsAfterPairing(remoteNodeId);
			},
			(result) => {
				if (result.ok) {
					void reloadSettingsAfterRotation(result.remoteNodeId);
					return;
				}

				showPeerConnectionResult(elements, "error", `Rotation failed: ${result.error}`);
			},
		),
	);

	const reloadSettingsAfterPairing = async (remoteNodeId: string) => {
		if (!client) {
			showPeerConnectionResult(elements, "success", `Paired with ${remoteNodeId}.`);
			return;
		}

		settings = normalizeControlMeshSettings(await client.getGlobalSettings());
		selectedPeerId = remoteNodeId;
		render();
		showPeerConnectionResult(elements, "success", `Paired with ${remoteNodeId}. Test the connection when ready.`);
	};

	const reloadSettingsAfterRotation = async (remoteNodeId: string) => {
		if (!client) {
			showPeerConnectionResult(elements, "success", `Rotated secret for ${remoteNodeId}.`);
			return;
		}

		settings = normalizeControlMeshSettings(await client.getGlobalSettings());
		selectedPeerId = remoteNodeId;
		peerTestAttempts.delete(remoteNodeId);
		render();
		showPeerConnectionResult(elements, "success", `Rotated secret for ${remoteNodeId}.`);
	};

	const validateNetworkSettings = (nextSettings: ControlMeshSettings) => {
		renderExecutorState(elements, nextSettings.executor.enabled);
		if (!client) {
			showNetworkResult(elements, "error", "Stream Deck client is not connected.");
			return;
		}

		pendingNetworkSettings = nextSettings;
		showNetworkResult(elements, "pending", `Checking port ${nextSettings.executor.listenPort}...`);
		void client.sendToPlugin({
			executorEnabled: nextSettings.executor.enabled,
			listenPort: nextSettings.executor.listenPort,
			type: "validateNetworkSettings",
		});
	};

	const bindAutoSave = () => {
		for (const element of [elements.localNodeName]) {
			bindValueChange(element, () => {
				if (isRendering) {
					return;
				}

				void persistSettings(readSettingsFromForm(elements, settings));
			});
		}

		for (const element of [elements.executorEnabled, elements.listenPort]) {
			bindValueChange(element, () => {
				if (isRendering) {
					return;
				}

				validateNetworkSettings(readSettingsFromForm(elements, settings));
			});
		}

		bindValueChange(elements.localMcpUrl, () => {
			if (isRendering) {
				return;
			}

			hideLocalMcpResult(elements);
			void persistSettings(readSettingsFromForm(elements, settings));
		});
	};

	const bindSections = () => {
		const showSelectedSetupSection = () => {
			showSetupSection(elements, normalizeSetupSection(getValue(elements.setupSection)));
		};

		bindValueChange(elements.setupSection, showSelectedSetupSection);
	};

	const bindButtons = () => {
		bindValueChange(elements.knownPeerSelector, () => {
			const previousPeerId = selectedPeerId;
			selectedPeerId = getValue(elements.knownPeerSelector);
			if (previousPeerId !== selectedPeerId) {
				peerTestAttempts.delete(previousPeerId);
			}
			render();
			clearValidation(elements);
		});

		elements.testLocalMcpButton.addEventListener("click", () => {
			const localMcpUrl = getValue(elements.localMcpUrl);
			if (!client) {
				showMissingClientLocalMcpError(elements);
				return;
			}

			void client.sendToPlugin({ localMcpUrl, type: "testLocalMcp" });
			showLocalMcpResult(elements, "pending", `Testing local MCP at ${localMcpUrl}...`);
		});

		elements.removePeerButton.addEventListener("click", () => {
			const remoteNodeId = getValue(elements.knownPeerSelector);
			if (!remoteNodeId) {
				showValidation(elements, "Peer id is required.");
				return;
			}

			selectedPeerId = "";
			void persistSettings(removeKnownPeer(settings, remoteNodeId));
			clearValidation(elements);
		});

		elements.pairPeerButton.addEventListener("click", () => {
			if (!client) {
				showValidation(elements, "Stream Deck client is not connected.");
				return;
			}

			const selectedPeer = getSelectedDiscoveredPeer(discoveredPeers, selectedPeerId);
			if (!selectedPeer) {
				showValidation(elements, "Select discovered peer to pair.");
				return;
			}

			clearValidation(elements);
			showPeerConnectionResult(elements, "pending", `Waiting for ${selectedPeer.nodeName} to approve pairing...`);
			void client.sendToPlugin({
				peerEndpoint: selectedPeer.endpoint,
				remoteNodeId: selectedPeer.nodeId,
				type: "requestPairing",
			});
		});

		elements.testPeerButton.addEventListener("click", () => {
			if (!client) {
				showValidation(elements, "Stream Deck client is not connected.");
				return;
			}

			const remoteNodeId = getValue(elements.knownPeerSelector);
			if (!remoteNodeId) {
				showValidation(elements, "Select a trusted peer to test.");
				return;
			}

			clearValidation(elements);
			showPeerConnectionResult(elements, "pending", `Testing peer ${remoteNodeId}...`);
			peerTestAttempts.set(remoteNodeId, { state: "pending" });
			void client.sendToPlugin({
				remoteNodeId,
				type: "testPeerConnection",
			});
		});

		elements.rotateSecretButton.addEventListener("click", () => {
			if (!client) {
				showValidation(elements, "Stream Deck client is not connected.");
				return;
			}

			const remoteNodeId = getValue(elements.knownPeerSelector);
			if (!remoteNodeId) {
				showValidation(elements, "Select a trusted peer to rotate.");
				return;
			}

			clearValidation(elements);
			showPeerConnectionResult(elements, "pending", `Rotating secret for ${remoteNodeId}...`);
			void client.sendToPlugin({
				remoteNodeId,
				type: "rotatePeerSecret",
			});
		});

		elements.discoverPeersButton.addEventListener("click", () => {
			requestDiscoveryRefresh(elements, client);
		});

		elements.approvePairingButton.addEventListener("click", () => {
			if (!client || !incomingPairingRequest) {
				return;
			}

			void client.sendToPlugin({
				requestId: incomingPairingRequest.requestId,
				type: "approvePairingRequest",
			});
			incomingPairingRequest = undefined;
			render();
		});

		elements.rejectPairingButton.addEventListener("click", () => {
			if (!client || !incomingPairingRequest) {
				return;
			}

			void client.sendToPlugin({
				requestId: incomingPairingRequest.requestId,
				type: "rejectPairingRequest",
			});
			incomingPairingRequest = undefined;
			render();
		});
	};

	const render = () => {
		isRendering = true;
		try {
			renderSettings(elements, settings, selectedPeerId, discoveredPeers);
			renderSelectedPeerFields(elements, settings, discoveredPeers, selectedPeerId);
			renderIncomingPairingRequest(elements, incomingPairingRequest);
			renderMeshActionControls(elements, settings, selectedPeerId, discoveredPeers, peerTestAttempts, !!client);
			showSetupSection(elements, normalizeSetupSection(getValue(elements.setupSection)));
		} finally {
			isRendering = false;
		}
	};

	bindAutoSave();
	bindSections();
	bindButtons();

	return {
		async load() {
			if (!client) {
				render();
				showValidation(elements, "Stream Deck client is not connected.");
				return;
			}

			settings = normalizeControlMeshSettings(await client.getGlobalSettings());
			selectedPeerId = settings.knownPeers[0]?.nodeId ?? "";
			client.setGlobalSettings(settings);
			render();
		},
	};
}

function getSetupElements(): SetupElements | undefined {
	const elements = {
		advertisedUrl: getRequiredElement<SdpiElement>("advertised-url"),
		approvePairingButton: getRequiredElement("approve-pairing-button"),
		discoveryPeersResult: getRequiredElement<SdpiElement>("discovery-result"),
		discoveryPeersResultItem: getRequiredElement("discovery-result-item"),
		executorEnabled: getRequiredElement<SdpiElement>("executor-enabled"),
		executorResults: Array.from(document.querySelectorAll<HTMLElement>("[data-executor-result]")),
		executorSettings: Array.from(document.querySelectorAll<HTMLElement>("[data-executor-setting]")),
		discoverPeersButton: getRequiredElement("discover-peers-button"),
		incomingPairingItem: getRequiredElement("incoming-pairing-item"),
		incomingPairingMessage: getRequiredElement<SdpiElement>("incoming-pairing-message"),
		knownPeerEndpoint: getRequiredElement<SdpiElement>("known-peer-endpoint"),
		knownPeerName: getRequiredElement<SdpiElement>("known-peer-name"),
		knownPeerSelectorItem: getRequiredElement("known-peer-selector-item"),
		knownPeerSelector: getRequiredElement<SdpiElement>("known-peer-selector"),
		listenPort: getRequiredElement<SdpiElement>("listen-port"),
		localMcpResult: getRequiredElement<SdpiElement>("local-mcp-result"),
		localMcpResultItem: getRequiredElement("local-mcp-result-item"),
		localMcpUrl: getRequiredElement<SdpiElement>("local-mcp-url"),
		localNodeName: getRequiredElement<SdpiElement>("local-node-name"),
		networkResult: getRequiredElement<SdpiElement>("network-result"),
		networkResultItem: getRequiredElement("network-result-item"),
		pairPeerButton: getRequiredElement("pair-peer-button"),
		peerConnectionState: getRequiredElement<SdpiElement>("peer-connection-state"),
		peerActionsItem: getRequiredElement("peer-actions-item"),
		peerDetails: Array.from(document.querySelectorAll<HTMLElement>("[data-peer-detail]")),
		peerStatusItem: getRequiredElement("peer-status-item"),
		removePeerButton: getRequiredElement("remove-peer-button"),
		rejectPairingButton: getRequiredElement("reject-pairing-button"),
		rotateSecretButton: getRequiredElement("rotate-secret-button"),
		setupHelp: getRequiredElement<SdpiElement>("setup-help"),
		setupSection: getRequiredElement<SdpiElement>("setup-section"),
		setupPanels: Array.from(document.querySelectorAll<HTMLElement>("[data-setup-panel]")),
		testLocalMcpButton: getRequiredElement("test-local-mcp-button"),
		testPeerButton: getRequiredElement("test-peer-button"),
		validationItem: document.getElementById("validation-item"),
		validationMessage: document.getElementById("validation-message") as SdpiElement | null,
	};

	return Object.values(elements).every((element) => element !== null) &&
		elements.executorResults.length > 0 &&
		elements.executorSettings.length > 0 &&
		elements.peerDetails.length > 0 &&
		elements.setupPanels.length > 0
		? elements
		: undefined;
}

function getRequiredElement<T extends HTMLElement = HTMLElement>(id: string): T {
	return document.getElementById(id) as T;
}

/**
 * Subscribes to value changes after SDPI components have updated their public `value`.
 */
export function bindValueChange(element: HTMLElement, handler: () => void): void {
	if (element.tagName.toLowerCase().startsWith("sdpi-")) {
		element.addEventListener("valuechange", handler);
		return;
	}

	element.addEventListener("input", handler);
	element.addEventListener("change", handler);
}

function showSetupSection(elements: SetupElements, selectedSectionName: string): void {
	const normalizedSection = normalizeSetupSection(selectedSectionName);

	for (const setupPanel of elements.setupPanels) {
		setupPanel.hidden = setupPanel.dataset.setupPanel !== normalizedSection;
	}
}

function normalizeSetupSection(sectionName: string): SetupSection {
	return sectionName === "mesh" ? "mesh" : "node";
}

function readSettingsFromForm(elements: SetupElements, currentSettings: ControlMeshSettings): ControlMeshSettings {
	return normalizeControlMeshSettings({
		...currentSettings,
		executor: {
			advertisedUrl: currentSettings.executor.advertisedUrl,
			enabled: getChecked(elements.executorEnabled),
			listenHost: currentSettings.executor.listenHost,
			listenPort: Number(getValue(elements.listenPort)) || currentSettings.executor.listenPort,
			localMcpUrl: getValue(elements.localMcpUrl),
		},
		localNode: {
			nodeId: currentSettings.localNode.nodeId,
			nodeName: getValue(elements.localNodeName) || currentSettings.localNode.nodeName,
		},
	});
}

function renderSettings(
	elements: SetupElements,
	settings: ControlMeshSettings,
	selectedPeerId: string,
	discoveredPeers: DiscoveredPeer[],
): void {
	setValue(elements.localNodeName, settings.localNode.nodeName);
	setValue(elements.localMcpUrl, settings.executor.localMcpUrl);
	setChecked(elements.executorEnabled, settings.executor.enabled);
	renderExecutorState(elements, settings.executor.enabled);
	setValue(elements.listenPort, String(settings.executor.listenPort));
	setValue(elements.advertisedUrl, settings.executor.advertisedUrl);
	renderPeerOptions(elements.knownPeerSelector, settings.knownPeers, discoveredPeers, selectedPeerId);
}

/**
 * Applies the visible executor section state for both persisted and pending settings.
 */
export function renderExecutorState(
	elements: Pick<SetupElements, "executorResults" | "executorSettings" | "listenPort">,
	enabled: boolean,
): void {
	setDisabled(elements.listenPort, !enabled);
	for (const executorSetting of elements.executorSettings) {
		executorSetting.hidden = !enabled;
	}
	if (!enabled) {
		for (const executorResult of elements.executorResults) {
			executorResult.hidden = true;
		}
	}
}

function renderSelectedPeerFields(
	elements: SetupElements,
	settings: ControlMeshSettings,
	discoveredPeers: DiscoveredPeer[],
	selectedPeerId: string,
): void {
	const selectedKnownPeer = settings.knownPeers.find((item) => item.nodeId === selectedPeerId);
	if (selectedKnownPeer) {
		renderPeerFields(elements, selectedKnownPeer);
		return;
	}

	const selectedDiscoveredPeer = discoveredPeers.find((peer) => peer.nodeId === selectedPeerId);
	if (selectedDiscoveredPeer) {
		renderDiscoveredPeerFields(elements, settings, selectedDiscoveredPeer);
		return;
	}

	clearPeerFields(elements);
}

function renderPeerFields(elements: SetupElements, peer: KnownPeer): void {
	setValue(elements.knownPeerName, peer.displayName);
	setValue(elements.knownPeerEndpoint, peer.endpoints[0] ?? "");
	setText(elements.peerConnectionState, getPeerStatusText(peer, false));
}

function renderDiscoveredPeerFields(
	elements: SetupElements,
	settings: ControlMeshSettings,
	peer: DiscoveredPeer,
): void {
	const knownPeer = settings.knownPeers.find((item) => item.nodeId === peer.nodeId);

	setValue(elements.knownPeerName, peer.nodeName);
	setValue(elements.knownPeerEndpoint, peer.endpoint);
	setText(elements.peerConnectionState, getPeerStatusText(knownPeer, false));
}

function clearPeerFields(elements: SetupElements): void {
	setValue(elements.knownPeerName, "");
	setValue(elements.knownPeerEndpoint, "");
	setText(elements.peerConnectionState, getPeerStatusText(undefined, true));
}

function renderIncomingPairingRequest(
	elements: Pick<SetupElements, "incomingPairingItem" | "incomingPairingMessage">,
	request: IncomingPairingRequest | undefined,
): void {
	elements.incomingPairingItem.hidden = !request;
	setText(elements.incomingPairingMessage, request ? `${request.nodeName} wants to pair.\n${request.endpoint}` : "");
}

function renderMeshActionControls(
	elements: SetupElements,
	settings: ControlMeshSettings,
	selectedPeerId: string,
	discoveredPeers: DiscoveredPeer[],
	peerTestAttempts: Map<string, PeerTestAttempt>,
	hasClient: boolean,
): void {
	const selectedPeer = settings.knownPeers.find((item) => item.nodeId === selectedPeerId);
	const selectedDiscoveredPeer = discoveredPeers.find((item) => item.nodeId === selectedPeerId);
	const selectedTrustLink = settings.trustLinks.find((item) => item.remoteNodeId === selectedPeerId && item.enabled);
	const hasEndpoint = selectedDiscoveredPeer
		? selectedDiscoveredPeer.endpoint.length > 0
		: Boolean(selectedPeer?.endpoints[0]);
	const hasAnyPeer = settings.knownPeers.length > 0 || discoveredPeers.length > 0;

	const canPairPeer = hasClient && Boolean(selectedDiscoveredPeer) && !selectedPeer && hasEndpoint;
	const canModifyPeer = hasClient && Boolean(selectedPeer);
	const canRunTrustedPeerAction = isTrustedPeerActionAllowed({
		hasClient,
		hasEndpoint,
		hasPeer: Boolean(selectedPeer),
		hasTrustLink: Boolean(selectedTrustLink),
	});
	const canTestPeer = canRunTrustedPeerAction;
	const canRotateSecret = canRunTrustedPeerAction;
	const hasSelection = selectedPeerId !== "";

	for (const peerDetail of elements.peerDetails) {
		setHidden(peerDetail, !hasSelection);
	}
	setHidden(elements.peerActionsItem, !hasSelection || (!hasAnyPeer && !hasClient));
	setHidden(elements.peerStatusItem, !hasSelection);
	setDisabled(elements.knownPeerSelector, !hasClient);
	setDisabled(elements.pairPeerButton, !canPairPeer);
	setDisabled(elements.removePeerButton, !canModifyPeer);
	setDisabled(elements.rotateSecretButton, !canRotateSecret);
	setDisabled(elements.testPeerButton, !canTestPeer);
}

/**
 * Returns whether a trusted peer has enough local state for authenticated operations.
 */
export function isTrustedPeerActionAllowed(input: {
	hasClient: boolean;
	hasEndpoint: boolean;
	hasPeer: boolean;
	hasTrustLink: boolean;
}): boolean {
	return input.hasClient && input.hasEndpoint && input.hasPeer && input.hasTrustLink;
}

function setHidden(element: { hidden: boolean }, hidden: boolean): void {
	element.hidden = hidden;
}

function renderPeerOptions(
	select: SdpiElement,
	knownPeers: KnownPeer[],
	discoveredPeers: DiscoveredPeer[],
	selectedNodeId: string,
): void {
	const trustedNodeIds = new Set<string>(knownPeers.map((peer) => peer.nodeId));
	const untrustedDiscoveredPeers = discoveredPeers.filter((peer) => !trustedNodeIds.has(peer.nodeId));
	const hasKnownPeers = knownPeers.length > 0;
	const hasDiscoveredPeers = untrustedDiscoveredPeers.length > 0;
	const hasSelection =
		selectedNodeId !== "" &&
		(knownPeers.some((peer) => peer.nodeId === selectedNodeId) ||
			untrustedDiscoveredPeers.some((peer) => peer.nodeId === selectedNodeId));
	const options: HTMLOptionElement[] = [createOption("", "Select peer")];

	if (hasKnownPeers) {
		options.push(createOption("__trusted__", "Trusted peers", true));
		for (const peer of knownPeers) {
			options.push(createOption(peer.nodeId, peer.displayName));
		}
	}

	if (hasDiscoveredPeers) {
		options.push(createOption("__discovered__", "Discovered peers", true));
		for (const peer of untrustedDiscoveredPeers) {
			options.push(createOption(peer.nodeId, `${peer.nodeName} - ${peer.endpoint}`));
		}
	}

	select.replaceChildren(...options);
	setValue(select, hasSelection ? selectedNodeId : "");
}

function getSelectedDiscoveredPeer(
	discoveredPeers: DiscoveredPeer[],
	selectedPeerId: string,
): DiscoveredPeer | undefined {
	return discoveredPeers.find((peer) => peer.nodeId === selectedPeerId);
}

function createOption(value: string, label: string, disabled = false): HTMLOptionElement {
	const option = document.createElement("option");
	option.disabled = disabled;
	option.value = value;
	option.textContent = label;
	return option;
}

function handlePluginMessage(
	elements: SetupElements,
	payload: unknown,
	onNetworkSettingsResult: (
		result: Extract<SetupResultMessage, { type: "validateNetworkSettingsResult" }>,
	) => Promise<void> | void,
	onDiscoveryResult: (result: Extract<SetupResultMessage, { type: "refreshDiscoveryResult" }>) => void,
	onPeerTestResult: (result: Extract<SetupResultMessage, { type: "testPeerConnectionResult" }>) => void,
	onPairingResult: (result: Extract<SetupResultMessage, { type: "requestPairingResult" }>) => void,
	onPairingRequest: (request: IncomingPairingRequest) => void,
	onPairingAccepted: (remoteNodeId: string) => void,
	onRotationResult: (result: Extract<SetupResultMessage, { type: "rotatePeerSecretResult" }>) => void,
): void {
	if (!isSetupResultMessage(payload)) {
		return;
	}

	if (payload.type === "testLocalMcpResult") {
		showLocalMcpResult(
			elements,
			payload.ok ? "success" : "error",
			payload.ok ? formatActionCountMessage(payload.actionCount, payload.url) : payload.error,
		);
		return;
	}

	if (payload.type === "refreshDiscoveryResult") {
		onDiscoveryResult(payload);
		showDiscoveryPeers(
			elements,
			payload.ok ? "success" : "error",
			payload.ok ? formatDiscoveredPeers(payload.discoveredPeers) : payload.error,
		);
		return;
	}

	if (payload.type === "validateNetworkSettingsResult") {
		void onNetworkSettingsResult(payload);
		return;
	}

	if (payload.type === "testPeerConnectionResult") {
		onPeerTestResult(payload);
		showPeerConnectionResult(
			elements,
			payload.ok ? "success" : "error",
			payload.ok ? `Peer ${payload.remoteNodeId} confirmed.` : `Peer failed: ${payload.error}`,
		);
		return;
	}

	if (payload.type === "requestPairingResult") {
		onPairingResult(payload);
		return;
	}

	if (payload.type === "rotatePeerSecretResult") {
		onRotationResult(payload);
		return;
	}

	if (payload.type === "pairingRequestReceived") {
		onPairingRequest(payload);
		return;
	}

	const acceptedPeerNodeId = getAcceptedPeerNodeId(payload);
	if (acceptedPeerNodeId) {
		onPairingAccepted(acceptedPeerNodeId);
	}
}

function isSetupResultMessage(payload: unknown): payload is SetupResultMessage {
	if (!payload || typeof payload !== "object" || !("type" in payload)) {
		return false;
	}

	const type = (payload as { type?: unknown }).type;
	return (
		type === "testLocalMcpResult" ||
		type === "refreshDiscoveryResult" ||
		type === "testPeerConnectionResult" ||
		type === "validateNetworkSettingsResult" ||
		type === "requestPairingResult" ||
		type === "pairingAccepted" ||
		type === "rotatePeerSecretResult" ||
		type === "pairingDecisionResult" ||
		type === "pairingRequestReceived"
	);
}

/**
 * Extracts the peer id from the notification sent after an approved pairing has been persisted.
 */
export function getAcceptedPeerNodeId(payload: unknown): string | undefined {
	if (!isSetupResultMessage(payload) || payload.type !== "pairingAccepted") {
		return undefined;
	}

	const remoteNodeId = typeof payload.remoteNodeId === "string" ? payload.remoteNodeId.trim() : "";
	return remoteNodeId || undefined;
}

function formatDiscoveredPeers(peers: DiscoveredPeer[]): string {
	if (peers.length === 0) {
		return "No peers discovered.";
	}

	const lines = peers.map(
		(peer) =>
			`${peer.nodeName} (${peer.nodeId})\n${peer.endpoint}\n${peer.version} • executor ${peer.executorEnabled ? "enabled" : "disabled"}`,
	);

	return lines.join("\n\n");
}

function formatActionCountMessage(actionCount: number, url: string): string {
	if (actionCount > 0) {
		return `Connected to ${url}. ${actionCount} executable actions found.`;
	}

	return `Connected to ${url}. No executable actions were returned by MCP.`;
}

function showDiscoveryPeers(elements: SetupElements, state: ConnectionResultState, message: string): void {
	elements.discoveryPeersResultItem.hidden = false;
	elements.discoveryPeersResult.dataset.state = state;
	setText(elements.discoveryPeersResult, message);
}

function showNetworkResult(elements: SetupElements, state: ConnectionResultState, message: string): void {
	elements.networkResultItem.hidden = false;
	elements.networkResult.dataset.state = state;
	setText(elements.networkResult, message);
}

function getPeerConnectionState(peer: KnownPeer | undefined): string {
	if (!peer) {
		return "Connection not tested";
	}

	if (!peer.endpoints[0]) {
		return "Peer is trusted but does not expose actions to mesh.";
	}

	if (peer.connection.state === "confirmed") {
		return "Connection confirmed";
	}

	if (peer.connection.state === "failed") {
		return peer.connection.lastError ? `Connection failed: ${peer.connection.lastError}` : "Connection failed";
	}

	return "Connection not tested";
}

function getPeerStatusText(peer: KnownPeer | undefined, noPeerSelected: boolean): string {
	if (noPeerSelected) {
		return "Select a peer to view status.";
	}

	return getPeerConnectionState(peer);
}

function getValue(element: SdpiElement): string {
	return String(element.value ?? "").trim();
}

function setValue(element: SdpiElement, value: string): void {
	element.value = value;
}

function getChecked(element: SdpiElement): boolean {
	if (typeof element.value === "boolean") {
		return element.value;
	}

	if (typeof element.value === "string") {
		return element.value === "true";
	}

	return Boolean(element.checked);
}

function setChecked(element: SdpiElement, checked: boolean): void {
	element.value = checked;
	element.checked = checked;
	element.toggleAttribute("checked", checked);
}

function setText(element: SdpiElement, value: string): void {
	element.value = value;
	element.textContent = value;
}

function setDisabled(element: SdpiElement, disabled: boolean): void {
	element.toggleAttribute("disabled", disabled);
}

function showLocalMcpResult(elements: SetupElements, state: ConnectionResultState, message: string): void {
	elements.localMcpResultItem.hidden = false;
	elements.localMcpResult.dataset.state = state;
	setText(elements.localMcpResult, message);
}

function showPeerConnectionResult(elements: SetupElements, state: ConnectionResultState, message: string): void {
	elements.peerConnectionState.dataset.state = state;
	setText(elements.peerConnectionState, message);
}

function hideLocalMcpResult(elements: SetupElements): void {
	elements.localMcpResultItem.hidden = true;
	delete elements.localMcpResult.dataset.state;
	setText(elements.localMcpResult, "");
}

function showMissingClientLocalMcpError(elements: SetupElements): void {
	showLocalMcpResult(elements, "error", "Stream Deck client is not connected.");
}

function requestDiscoveryRefresh(elements: SetupElements, client: StreamDeckClient | undefined): void {
	if (!client) {
		showDiscoveryPeers(elements, "error", "Stream Deck client is not connected.");
		return;
	}

	void client.sendToPlugin({ type: "refreshDiscovery" });
	showDiscoveryPeers(elements, "pending", "Scanning local network...");
}

function showValidation(elements: SetupElements, message: string): void {
	if (elements.validationItem) {
		elements.validationItem.hidden = false;
	}

	if (elements.validationMessage) {
		setText(elements.validationMessage, message);
	}
}

function clearValidation(elements: SetupElements): void {
	if (elements.validationItem) {
		elements.validationItem.hidden = true;
	}

	if (elements.validationMessage) {
		setText(elements.validationMessage, "");
	}
}
