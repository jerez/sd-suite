export type StreamDeckClient = {
	getGlobalSettings(): Promise<unknown>;
	getSettings(): Promise<unknown>;
	onPluginMessage(listener: (payload: unknown) => void): () => void;
	sendToPlugin(payload: unknown): Promise<void>;
	setGlobalSettings(settings: unknown): Promise<void>;
	setSettings(settings: unknown): Promise<void>;
};

type StreamDeckMessage = {
	payload?: unknown;
};

type StreamDeckEventShape = StreamDeckMessage | { [key: string]: unknown };

type SdpiStreamDeckClient = {
	getGlobalSettings(): Promise<unknown>;
	getSettings(): Promise<unknown>;
	send(event: "sendToPlugin", payload: unknown): Promise<void>;
	sendToPropertyInspector: {
		subscribe(listener: (event: StreamDeckMessage) => void): void;
		unsubscribe(listener: (event: StreamDeckMessage) => void): void;
	};
	setGlobalSettings(settings: unknown): Promise<void>;
	setSettings(settings: unknown): Promise<void>;
};

declare global {
	interface Window {
		SDPIComponents?: {
			streamDeckClient?: SdpiStreamDeckClient;
		};
	}
}

/**
 * Returns the official Stream Deck property inspector client when the webview is running inside Stream Deck.
 */
export function getStreamDeckClient(): StreamDeckClient | undefined {
	const sdpiClient = window.SDPIComponents?.streamDeckClient;

	if (!sdpiClient) {
		return undefined;
	}

	return createSdpiStreamDeckClient(sdpiClient);
}

function createSdpiStreamDeckClient(sdpiClient: SdpiStreamDeckClient): StreamDeckClient {
	return {
		getGlobalSettings() {
			return readSettingsPayload(sdpiClient.getGlobalSettings());
		},
		async getSettings() {
			return readSettingsPayload(await sdpiClient.getSettings());
		},
		onPluginMessage(listener) {
			const handler = (event: StreamDeckMessage | StreamDeckEventShape) => {
				listener(extractMessagePayload(event));
			};
			sdpiClient.sendToPropertyInspector.subscribe(handler);

			return () => {
				sdpiClient.sendToPropertyInspector.unsubscribe(handler);
			};
		},
		sendToPlugin(payload) {
			return sdpiClient.send("sendToPlugin", payload);
		},
		setGlobalSettings(settings) {
			return sdpiClient.setGlobalSettings(settings);
		},
		setSettings(settings) {
			return sdpiClient.setSettings(settings);
		},
	};
}

function extractMessagePayload(event: StreamDeckMessage | StreamDeckEventShape): unknown {
	if (event && typeof event === "object" && "payload" in event) {
		return (event as StreamDeckMessage).payload;
	}

	return event;
}

async function readSettingsPayload(payload: unknown): Promise<unknown> {
	const resolvedPayload = await payload;

	if (resolvedPayload && typeof resolvedPayload === "object" && "settings" in resolvedPayload) {
		return (resolvedPayload as { settings?: unknown }).settings ?? {};
	}

	return resolvedPayload ?? {};
}
