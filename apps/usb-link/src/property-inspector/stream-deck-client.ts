/**
 * Minimal Stream Deck property-inspector client surface used by USB Link.
 */
export type StreamDeckClient = {
	getSettings(): Promise<unknown>;
	setSettings(settings: unknown): Promise<void>;
};

type SdpiStreamDeckClient = {
	getSettings(): Promise<unknown>;
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
 * Returns the Stream Deck property-inspector client when the SDPI runtime is available.
 */
export function getStreamDeckClient(): StreamDeckClient | undefined {
	const sdpiClient = window.SDPIComponents?.streamDeckClient;
	if (!sdpiClient) {
		return undefined;
	}

	return {
		async getSettings() {
			return readSettingsPayload(await sdpiClient.getSettings());
		},
		setSettings(settings) {
			return sdpiClient.setSettings(settings);
		},
	};
}

async function readSettingsPayload(payload: unknown): Promise<unknown> {
	const resolvedPayload = await payload;

	if (resolvedPayload && typeof resolvedPayload === "object" && "settings" in resolvedPayload) {
		return (resolvedPayload as { settings?: unknown }).settings ?? {};
	}

	return resolvedPayload ?? {};
}
