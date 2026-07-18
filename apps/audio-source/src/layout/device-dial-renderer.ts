import type { DialAction } from "@elgato/streamdeck";

import type { AudioDevice } from "../audio/types";
import { type DeviceIconScope, renderAudioDeviceIcon } from "./components/audio-device-icon";
import { buildDeviceRibbonCarousel, type DeviceRibbonCarouselModel } from "./components/device-ribbon-carousel";
import { buildDialLabel } from "./components/dial-label";
import { formatTransportTypeLabel, renderTransportDetailIcon } from "./components/transport-detail";

export type DeviceDialRendererOptions = {
	layout: string;
	noDeviceTitle: string;
	iconScope: DeviceIconScope;
};

type DialRendererAction = DialAction<Record<string, never>>;

/**
 * View-layer renderer for dial feedback.
 */
export class DeviceDialRenderer {
	private readonly layout: string;
	private readonly noDeviceTitle: string;
	private readonly iconScope: DeviceIconScope;

	constructor(options: DeviceDialRendererOptions) {
		this.layout = options.layout;
		this.noDeviceTitle = options.noDeviceTitle;
		this.iconScope = options.iconScope;
	}

	/**
	 * Applies the dial layout configured for this action.
	 */
	async applyLayout(action: unknown): Promise<void> {
		if (!isDialActionWithLayout(action)) {
			return;
		}

		await action.setFeedbackLayout(this.layout);
	}

	/**
	 * Clears renderer-owned state for an action instance.
	 */
	clear(actionId: string): void {
		void actionId;
	}

	/**
	 * Renders IDLE mode (active device icon + label).
	 */
	async renderIdle(actionId: string, action: DialRendererAction, device: AudioDevice | null): Promise<void> {
		void actionId;
		const deviceName = normalizeName(device?.name ?? this.noDeviceTitle, this.noDeviceTitle);

		await action.setFeedback({
			idleIcon: {
				enabled: true,
				opacity: 1,
				value: renderAudioDeviceIcon({
					formFactor: device?.formFactor,
					isDisabled: device?.isDisabled,
					isMuted: device?.isMuted,
					scope: this.iconScope,
					size: 38,
				}),
			},
			idleLabel: {
				enabled: true,
				...buildDialLabel(deviceName),
			},
			...hiddenBrowseState(),
			...hiddenConfirmState(),
			...hiddenDetailsState(),
		});
	}

	/**
	 * Renders BROWSE mode (ribbon carousel + selected label).
	 */
	async renderBrowse(actionId: string, action: DialRendererAction, model: DeviceRibbonCarouselModel): Promise<void> {
		void actionId;

		await action.setFeedback({
			...hiddenIdleState(),
			...buildDeviceRibbonCarousel({
				next: model.next,
				previous: model.previous,
				selected: model.selected,
				scope: this.iconScope,
			}),
			browseLabel: {
				enabled: true,
				...buildDialLabel(normalizeName(model.selected.name, this.noDeviceTitle)),
			},
			...hiddenConfirmState(),
			...hiddenDetailsState(),
		});
	}

	/**
	 * Renders CONFIRM mode (checkmark + confirmed device name).
	 */
	async renderConfirm(actionId: string, action: DialRendererAction, deviceName: string): Promise<void> {
		void actionId;
		const label = `✓ ${normalizeName(deviceName, this.noDeviceTitle)}`;

		await action.setFeedback({
			...hiddenIdleState(),
			...hiddenBrowseState(),
			confirmLabel: {
				enabled: true,
				...buildDialLabel(label),
			},
			...hiddenDetailsState(),
		});
	}

	/**
	 * Renders DETAILS mode (transport icon + transport label + device label).
	 */
	async renderDetails(actionId: string, action: DialRendererAction, device: AudioDevice | null): Promise<void> {
		void actionId;
		const detailDeviceName = normalizeName(device?.name ?? this.noDeviceTitle, this.noDeviceTitle);
		const transportLabel = formatTransportTypeLabel(device?.transportType);

		await action.setFeedback({
			...hiddenIdleState(),
			...hiddenBrowseState(),
			...hiddenConfirmState(),
			detailTransportIcon: {
				enabled: true,
				opacity: 1,
				value: renderTransportDetailIcon({
					transportType: device?.transportType,
					size: 18,
				}),
			},
			detailTransportLabel: {
				enabled: true,
				...buildDialLabel(transportLabel),
			},
			detailDeviceLabel: {
				enabled: true,
				...buildDialLabel(detailDeviceName),
			},
		});
	}
}

/**
 * Type guard for dial actions that support `setFeedbackLayout`.
 */
function isDialActionWithLayout(action: unknown): action is { setFeedbackLayout(layout: string): Promise<void> } {
	return Boolean(
		action &&
		typeof action === "object" &&
		"setFeedbackLayout" in action &&
		typeof (action as { setFeedbackLayout?: unknown }).setFeedbackLayout === "function",
	);
}

/**
 * Hidden payload values for idle items.
 */
function hiddenIdleState(): Record<string, unknown> {
	return {
		idleIcon: { enabled: false, opacity: 0 },
		idleLabel: { enabled: false, value: "" },
	};
}

/**
 * Hidden payload values for browse items.
 */
function hiddenBrowseState(): Record<string, unknown> {
	return {
		browsePrevIcon: { enabled: false, opacity: 0 },
		browseCenterIcon: { enabled: false, opacity: 0 },
		browseNextIcon: { enabled: false, opacity: 0 },
		browseLabel: { enabled: false, value: "" },
	};
}

/**
 * Hidden payload values for confirm items.
 */
function hiddenConfirmState(): Record<string, unknown> {
	return {
		confirmLabel: { enabled: false, value: "" },
	};
}

/**
 * Hidden payload values for details items.
 */
function hiddenDetailsState(): Record<string, unknown> {
	return {
		detailTransportIcon: { enabled: false, opacity: 0 },
		detailTransportLabel: { enabled: false, value: "" },
		detailDeviceLabel: { enabled: false, value: "" },
	};
}

/**
 * Normalizes device names used by UI rendering.
 */
function normalizeName(name: string, fallback: string): string {
	const trimmed = name.trim();
	return trimmed || fallback;
}
