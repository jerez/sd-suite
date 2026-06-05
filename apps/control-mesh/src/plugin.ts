import streamDeck from "@elgato/streamdeck";
import { hostname } from "node:os";

import { type ControlMeshSettings, normalizeControlMeshSettings } from "./settings/control-mesh-settings";
import { ControlMeshSetup } from "./actions/control-mesh-setup";
import { createPluginRuntime } from "./plugin-runtime";
import { ExecuteRemoteAction } from "./actions/execute-remote-action";
import { createPairingApprovalBroker } from "./pairing/pairing-approval-broker";

streamDeck.logger.setLevel("trace");

async function main(): Promise<void> {
	const pairingApprovalBroker = createPairingApprovalBroker({
		sendToPropertyInspector: (message) => streamDeck.ui.sendToPropertyInspector(message),
	});
	const runtime = createPluginRuntime({
		getSettings: () => getGlobalSettings(),
		onPairingAccepted: (remoteNodeId) => {
			void streamDeck.ui.sendToPropertyInspector({ ok: true, remoteNodeId, type: "pairingAccepted" });
		},
		requestPairingApproval: (request) => pairingApprovalBroker.requestApproval(request),
		setSettings: (settings) => streamDeck.settings.setGlobalSettings(settings),
	});
	let runtimeStarted = false;
	let reconcileInProgress = false;
	let runtimeSettingsSnapshot: string | undefined;

	streamDeck.actions.registerAction(
		new ControlMeshSetup({
			approvePairingRequest: (requestId) => pairingApprovalBroker.approve(requestId),
			rejectPairingRequest: (requestId) => pairingApprovalBroker.reject(requestId),
			runtime,
			setPairingApprovalVisible: (visible) => pairingApprovalBroker.setVisible(visible),
		}),
	);
	streamDeck.actions.registerAction(new ExecuteRemoteAction({ runtime }));

	const reconcileRuntime = async () => {
		if (reconcileInProgress) {
			return;
		}

		reconcileInProgress = true;

		try {
			const settings = normalizeControlMeshSettings(await runtime.getSettings());
			const nextSnapshot = createRuntimeSettingsSnapshot(settings);

			if (!runtimeStarted || runtimeSettingsSnapshot !== nextSnapshot) {
				if (runtimeStarted) {
					await runtime.stop();
				}

				await runtime.start();
				runtimeStarted = true;
				runtimeSettingsSnapshot = nextSnapshot;
			}
		} catch (error) {
			runtimeStarted = false;
			runtimeSettingsSnapshot = undefined;
			streamDeck.logger.error(`Control Mesh runtime reconciliation failed: ${String(error)}`);
		} finally {
			reconcileInProgress = false;
		}
	};

	// Runtime startup reads Stream Deck settings, which requires the plugin websocket connection.
	await streamDeck.connect();
	await initializeGlobalSettings(runtime);
	streamDeck.settings.onDidReceiveGlobalSettings(() => {
		void reconcileRuntime();
	});
	await reconcileRuntime();
}

/**
 * Ensures Stream Deck global settings include defaults and a stable local node identity.
 */
async function initializeGlobalSettings(runtime: { getSettings(): Promise<ControlMeshSettings> }): Promise<void> {
	const normalizedSettings = await runtime.getSettings();
	await streamDeck.settings.setGlobalSettings(normalizedSettings);
}

void main();

async function getGlobalSettings(): Promise<ControlMeshSettings> {
	return normalizeControlMeshSettings(await streamDeck.settings.getGlobalSettings<ControlMeshSettings>(), {
		advertisedHost: hostname(),
	});
}

function createRuntimeSettingsSnapshot(settings: ControlMeshSettings): string {
	return JSON.stringify({
		executor: {
			advertisedUrl: settings.executor.advertisedUrl,
			enabled: settings.executor.enabled,
			listenHost: settings.executor.listenHost,
			listenPort: settings.executor.listenPort,
			localMcpUrl: settings.executor.localMcpUrl,
		},
		localNode: {
			nodeId: settings.localNode.nodeId,
			nodeName: settings.localNode.nodeName,
		},
	});
}
