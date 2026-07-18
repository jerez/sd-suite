import type { AudioDevice } from "../../audio/types";
import { type DeviceIconScope, renderAudioDeviceIcon } from "./audio-device-icon";

const CENTER_ICON_SIZE = 38;
const SIDE_ICON_SIZE = 28;

/**
 * Browse-state model for ribbon carousel rendering.
 */
export type DeviceRibbonCarouselModel = {
	previous: AudioDevice;
	selected: AudioDevice;
	next: AudioDevice;
	scope: DeviceIconScope;
};

/**
 * Builds feedback payload fragment for the three-icon ribbon carousel.
 */
export function buildDeviceRibbonCarousel(model: DeviceRibbonCarouselModel): Record<string, unknown> {
	return {
		browsePrevIcon: {
			enabled: true,
			opacity: 0.5,
			value: renderAudioDeviceIcon({
				formFactor: model.previous.formFactor,
				isDisabled: model.previous.isDisabled,
				isMuted: model.previous.isMuted,
				scope: model.scope,
				size: SIDE_ICON_SIZE,
			}),
		},
		browseCenterIcon: {
			enabled: true,
			opacity: 1,
			value: renderAudioDeviceIcon({
				formFactor: model.selected.formFactor,
				isDisabled: model.selected.isDisabled,
				isMuted: model.selected.isMuted,
				scope: model.scope,
				size: CENTER_ICON_SIZE,
			}),
		},
		browseNextIcon: {
			enabled: true,
			opacity: 0.5,
			value: renderAudioDeviceIcon({
				formFactor: model.next.formFactor,
				isDisabled: model.next.isDisabled,
				isMuted: model.next.isMuted,
				scope: model.scope,
				size: SIDE_ICON_SIZE,
			}),
		},
	};
}
