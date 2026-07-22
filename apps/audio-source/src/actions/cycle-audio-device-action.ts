import {
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DialUpEvent,
	SingletonAction,
	streamDeck,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import type { AudioDevice } from "../audio";
import type { ConfirmResult, PreviewSelection } from "../switching/device-switcher";
import { TimedCache } from "../shared/timed-cache";

const PREVIEW_RESET_MS = 3_500;
const CONFIRM_RESET_MS = 750;
const DETAILS_RESET_MS = 3_500;
const DEVICE_CACHE_TTL_MS = 60_000;

type ActionSettings = Record<string, never>;

type BrowseState = {
	deviceIds: string[];
	selectedIndex: number;
};

type BrowseModel = {
	previous: AudioDevice;
	selected: AudioDevice;
	next: AudioDevice;
};

type DeviceSwitcherLike = {
	initialize(actionId: string): Promise<string>;
	clear(actionId: string): void;
	preview(actionId: string, ticks: number): Promise<PreviewSelection | null>;
	confirm(actionId: string): Promise<ConfirmResult>;
	revert(actionId: string): Promise<string>;
};

type DialRendererLike = {
	applyLayout(action: unknown): Promise<void>;
	clear(actionId: string): void;
	renderIdle(actionId: string, action: DialAction<ActionSettings>, device: AudioDevice | null): Promise<void>;
	renderBrowse(actionId: string, action: DialAction<ActionSettings>, model: BrowseModel): Promise<void>;
	renderConfirm(actionId: string, action: DialAction<ActionSettings>, deviceName: string): Promise<void>;
	renderDetails(actionId: string, action: DialAction<ActionSettings>, device: AudioDevice | null): Promise<void>;
};

export type CycleAudioDeviceActionOptions = {
	noDeviceTitle: string;
	switcher: DeviceSwitcherLike;
	renderer: DialRendererLike;
	getAudioDevices(): Promise<AudioDevice[]>;
	getDefaultDevice(): Promise<AudioDevice | null>;
	subscribeDefaultDeviceChanges(listener: () => void): Promise<() => void>;
};

/**
 * Shared Stream Deck dial action that orchestrates switching behavior and
 * dial feedback rendering for a given audio scope.
 */
export abstract class CycleAudioDeviceAction extends SingletonAction<ActionSettings> {
	private readonly noDeviceTitle: string;
	private readonly switcher: DeviceSwitcherLike;
	private readonly renderer: DialRendererLike;
	private readonly getAudioDevices: () => Promise<AudioDevice[]>;
	private readonly getDefaultDevice: () => Promise<AudioDevice | null>;
	private readonly subscribeDefaultDeviceChanges: (listener: () => void) => Promise<() => void>;

	private readonly previewResetByActionId = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly confirmResetByActionId = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly detailsResetByActionId = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly dialActionsById = new Map<string, DialAction<ActionSettings>>();
	private readonly browseStateByActionId = new Map<string, BrowseState>();
	private readonly previewingActionIds = new Set<string>();
	private readonly confirmingActionIds = new Set<string>();
	private readonly showingDetailsActionIds = new Set<string>();
	private readonly confirmLabelByActionId = new Map<string, string>();
	private readonly lastActiveStateByActionId = new Map<string, string>();
	private readonly audioDevicesCache = new TimedCache<AudioDevice[]>(DEVICE_CACHE_TTL_MS);
	private readonly defaultDeviceCache = new TimedCache<AudioDevice | null>(DEVICE_CACHE_TTL_MS);
	private stopDefaultChangeSubscription: (() => void) | null = null;
	private ensureDefaultChangeSubscriptionPromise: Promise<void> | null = null;
	private isDefaultChangeSyncInFlight = false;
	private hasPendingDefaultChangeSync = false;

	protected constructor(options: CycleAudioDeviceActionOptions) {
		super();
		this.noDeviceTitle = options.noDeviceTitle;
		this.switcher = options.switcher;
		this.renderer = options.renderer;
		this.getAudioDevices = options.getAudioDevices;
		this.getDefaultDevice = options.getDefaultDevice;
		this.subscribeDefaultDeviceChanges = options.subscribeDefaultDeviceChanges;
	}

	override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
		try {
			this.invalidateDeviceCache();
			this.clearPreviewReset(ev.action.id);
			this.clearConfirmReset(ev.action.id);
			this.clearDetailsReset(ev.action.id);
			this.switcher.clear(ev.action.id);
			this.renderer.clear(ev.action.id);
			this.previewingActionIds.delete(ev.action.id);
			this.confirmingActionIds.delete(ev.action.id);
			this.showingDetailsActionIds.delete(ev.action.id);
			this.confirmLabelByActionId.delete(ev.action.id);
			this.lastActiveStateByActionId.delete(ev.action.id);
			this.browseStateByActionId.delete(ev.action.id);

			await this.renderer.applyLayout(ev.action);

			const [, activeDevice] = await Promise.all([this.switcher.initialize(ev.action.id), this.getActiveDevice()]);

			await this.renderIdleAndTrack(ev.action.id, ev.action as DialAction<ActionSettings>, activeDevice);
			if (isDialAction(ev.action)) {
				this.dialActionsById.set(ev.action.id, ev.action);
				await this.ensureDefaultChangeSubscription();
			}
		} catch (error) {
			streamDeck.logger.error("Error in onWillAppear:", error);
			await ev.action.setTitle("Error");
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<ActionSettings>): void {
		this.clearPreviewReset(ev.action.id);
		this.clearConfirmReset(ev.action.id);
		this.clearDetailsReset(ev.action.id);
		this.switcher.clear(ev.action.id);
		this.renderer.clear(ev.action.id);
		this.previewingActionIds.delete(ev.action.id);
		this.confirmingActionIds.delete(ev.action.id);
		this.showingDetailsActionIds.delete(ev.action.id);
		this.confirmLabelByActionId.delete(ev.action.id);
		this.lastActiveStateByActionId.delete(ev.action.id);
		this.browseStateByActionId.delete(ev.action.id);
		this.dialActionsById.delete(ev.action.id);

		if (this.dialActionsById.size === 0) {
			this.clearDefaultChangeSubscription();
		}
	}

	override async onDialRotate(ev: DialRotateEvent<ActionSettings>): Promise<void> {
		const ticks = ev.payload.ticks;

		if (ticks === 0) {
			return;
		}

		try {
			this.clearConfirmReset(ev.action.id);
			this.clearDetailsReset(ev.action.id);
			// A new rotate gesture always exits transient confirm/details states.
			this.confirmingActionIds.delete(ev.action.id);
			this.showingDetailsActionIds.delete(ev.action.id);
			this.confirmLabelByActionId.delete(ev.action.id);

			// Preview computes the next selection for this tick without applying it.
			const preview = await this.switcher.preview(ev.action.id, ticks);
			if (!preview) {
				this.previewingActionIds.delete(ev.action.id);
				this.browseStateByActionId.delete(ev.action.id);
				const activeDevice = await this.getActiveDevice();
				await this.renderIdleAndTrack(ev.action.id, ev.action, activeDevice);
				return;
			}

			this.previewingActionIds.add(ev.action.id);
			const model = await this.advanceBrowseState(ev.action.id, preview.selectedId);

			if (model) {
				// Rendering is intentionally non-blocking so dial input remains snappy.
				void this.renderer.renderBrowse(ev.action.id, ev.action, model);
			} else {
				// Fallback path when no devices are available for carousel rendering.
				void this.renderIdleAndTrack(ev.action.id, ev.action, {
					id: "preview",
					name: preview.selectedName,
				});
			}

			this.armPreviewReset(ev.action.id, ev.action);
		} catch (error) {
			streamDeck.logger.error("Error in onDialRotate:", error);
			await ev.action.setTitle("Error");
		}
	}

	override async onDialDown(ev: DialDownEvent<ActionSettings>): Promise<void> {
		try {
			this.clearPreviewReset(ev.action.id);
			this.clearConfirmReset(ev.action.id);
			this.clearDetailsReset(ev.action.id);
			this.previewingActionIds.delete(ev.action.id);
			this.showingDetailsActionIds.delete(ev.action.id);
			this.browseStateByActionId.delete(ev.action.id);
			this.invalidateDeviceCache();

			const result = await this.switcher.confirm(ev.action.id);
			this.confirmingActionIds.add(ev.action.id);
			this.confirmLabelByActionId.set(ev.action.id, result.activeName);
			this.renderer.renderConfirm(ev.action.id, ev.action, result.activeName);
			this.armConfirmReset(ev.action.id, ev.action);
		} catch (error) {
			streamDeck.logger.error("Error in onDialDown:", error);
			await ev.action.setTitle("Error");
		}
	}

	override async onDialUp(ev: DialUpEvent<ActionSettings>): Promise<void> {
		void ev;
	}

	override async onTouchTap(ev: TouchTapEvent<ActionSettings>): Promise<void> {
		try {
			this.clearPreviewReset(ev.action.id);
			this.clearConfirmReset(ev.action.id);
			this.clearDetailsReset(ev.action.id);

			if (this.previewingActionIds.has(ev.action.id)) {
				this.invalidateDeviceCache();
				await this.switcher.revert(ev.action.id);
				this.previewingActionIds.delete(ev.action.id);
				this.browseStateByActionId.delete(ev.action.id);
			}

			this.confirmingActionIds.delete(ev.action.id);
			this.confirmLabelByActionId.delete(ev.action.id);

			const device = await this.getActiveDevice();
			await this.renderer.renderDetails(ev.action.id, ev.action, device);
			this.showingDetailsActionIds.add(ev.action.id);
			this.armDetailsReset(ev.action.id, ev.action);
		} catch (error) {
			streamDeck.logger.error("Error in onTouchTap:", error);
			await ev.action.setTitle("Error");
		}
	}

	/**
	 * Starts/refreshes the preview reset timer that restores idle rendering when
	 * rotate preview mode is left inactive for too long.
	 */
	private armPreviewReset(actionId: string, action: DialAction<ActionSettings>): void {
		this.clearPreviewReset(actionId);
		const timer = setTimeout(() => {
			// Refresh cache before resolving active device for return-to-idle.
			this.invalidateDeviceCache();
			void this.switcher
				.revert(actionId)
				.then(async () => {
					this.previewingActionIds.delete(actionId);
					this.browseStateByActionId.delete(actionId);
					const activeDevice = await this.getActiveDevice();
					await this.renderIdleAndTrack(actionId, action, activeDevice);
				})
				.catch((error) => {
					streamDeck.logger.error("Error restoring display after preview timeout:", error);
				});
		}, PREVIEW_RESET_MS);

		this.previewResetByActionId.set(actionId, timer);
	}

	/**
	 * Starts/refreshes the confirm reset timer so the temporary confirm state is
	 * automatically replaced by idle state.
	 */
	private armConfirmReset(actionId: string, action: DialAction<ActionSettings>): void {
		this.clearConfirmReset(actionId);
		const timer = setTimeout(() => {
			this.invalidateDeviceCache();
			void this.renderIdleAndTrack(actionId, action, this.getActiveDevice())
				.catch((error) => {
					streamDeck.logger.error("Error restoring display after confirm timeout:", error);
				})
				.finally(() => {
					this.confirmingActionIds.delete(actionId);
					this.confirmLabelByActionId.delete(actionId);
				});
		}, CONFIRM_RESET_MS);

		this.confirmResetByActionId.set(actionId, timer);
	}

	/**
	 * Clears and removes any pending preview reset timer for an action.
	 */
	private clearPreviewReset(actionId: string): void {
		const timer = this.previewResetByActionId.get(actionId);
		if (timer) {
			clearTimeout(timer);
		}

		this.previewResetByActionId.delete(actionId);
	}

	/**
	 * Clears and removes any pending confirm reset timer for an action.
	 */
	private clearConfirmReset(actionId: string): void {
		const timer = this.confirmResetByActionId.get(actionId);
		if (timer) {
			clearTimeout(timer);
		}

		this.confirmResetByActionId.delete(actionId);
	}

	/**
	 * Starts/refreshes the details reset timer so details view falls back to idle
	 * view after a short dwell period.
	 */
	private armDetailsReset(actionId: string, action: DialAction<ActionSettings>): void {
		this.clearDetailsReset(actionId);
		const timer = setTimeout(() => {
			this.invalidateDeviceCache();
			void this.renderIdleAndTrack(actionId, action, this.getActiveDevice())
				.catch((error) => {
					streamDeck.logger.error("Error restoring display after details timeout:", error);
				})
				.finally(() => {
					this.showingDetailsActionIds.delete(actionId);
				});
		}, DETAILS_RESET_MS);

		this.detailsResetByActionId.set(actionId, timer);
	}

	/**
	 * Clears and removes any pending details reset timer for an action.
	 */
	private clearDetailsReset(actionId: string): void {
		const timer = this.detailsResetByActionId.get(actionId);
		if (timer) {
			clearTimeout(timer);
		}

		this.detailsResetByActionId.delete(actionId);
	}

	/**
	 * Ensures a single native default-device subscription is active while at
	 * least one dial action instance is visible.
	 */
	private async ensureDefaultChangeSubscription(): Promise<void> {
		if (
			this.stopDefaultChangeSubscription ||
			this.ensureDefaultChangeSubscriptionPromise ||
			this.dialActionsById.size === 0
		) {
			return;
		}

		this.ensureDefaultChangeSubscriptionPromise = this.subscribeDefaultDeviceChanges(() => {
			this.scheduleDefaultChangeSync();
		})
			.then((stop) => {
				if (this.dialActionsById.size === 0) {
					stop();
					return;
				}

				this.stopDefaultChangeSubscription = stop;
			})
			.catch((error) => {
				streamDeck.logger.error("Error subscribing to native default-device changes:", error);
			})
			.finally(() => {
				this.ensureDefaultChangeSubscriptionPromise = null;
			});

		await this.ensureDefaultChangeSubscriptionPromise;
	}

	/**
	 * Stops and clears the active native default-device subscription.
	 */
	private clearDefaultChangeSubscription(): void {
		const stop = this.stopDefaultChangeSubscription;
		if (stop) {
			stop();
		}

		this.stopDefaultChangeSubscription = null;
	}

	/**
	 * Coalesces overlapping native change notifications into a serialized sync
	 * loop so UI refreshes do not overlap or race each other.
	 */
	private scheduleDefaultChangeSync(): void {
		if (this.isDefaultChangeSyncInFlight) {
			// Coalesce bursts of native events into one additional sync pass.
			this.hasPendingDefaultChangeSync = true;
			return;
		}

		this.isDefaultChangeSyncInFlight = true;

		void this.syncVisibleDialActionsFromSystem().finally(() => {
			this.isDefaultChangeSyncInFlight = false;

			if (this.hasPendingDefaultChangeSync) {
				this.hasPendingDefaultChangeSync = false;
				this.scheduleDefaultChangeSync();
			}
		});
	}

	/**
	 * Re-renders all visible dial actions that are currently in idle mode when
	 * system state changes, skipping actions already in preview/confirm/details.
	 */
	private async syncVisibleDialActionsFromSystem(): Promise<void> {
		if (this.dialActionsById.size === 0) {
			return;
		}

		this.invalidateDeviceCache();
		const activeDevice = await this.getActiveDevice();
		const activeState = deviceStateSignature(activeDevice, this.noDeviceTitle);
		const renderTasks: Promise<void>[] = [];

		for (const [actionId, action] of this.dialActionsById.entries()) {
			// Do not interrupt active interaction modes.
			if (
				this.previewingActionIds.has(actionId) ||
				this.confirmingActionIds.has(actionId) ||
				this.showingDetailsActionIds.has(actionId)
			) {
				continue;
			}

			// Skip rendering when effective state is unchanged.
			if (this.lastActiveStateByActionId.get(actionId) === activeState) {
				continue;
			}

			this.switcher.clear(actionId);
			this.browseStateByActionId.delete(actionId);
			renderTasks.push(this.renderIdleAndTrack(actionId, action, activeDevice));
		}

		await Promise.all(renderTasks);
	}

	/**
	 * Builds the browse carousel model from the currently selected device id.
	 */
	private async advanceBrowseState(actionId: string, selectedId: string): Promise<BrowseModel | null> {
		const devices = await this.getCachedAudioDevices();

		if (devices.length === 0) {
			this.browseStateByActionId.delete(actionId);
			return null;
		}

		const deviceIds = devices.map((device) => device.id);
		let selectedIndex = devices.findIndex((device) => device.id === selectedId);
		// If selected id disappeared, keep browse UX deterministic by using first.
		if (selectedIndex < 0) {
			selectedIndex = 0;
		}

		this.browseStateByActionId.set(actionId, { deviceIds, selectedIndex });

		const selected = devices[selectedIndex]!;
		const previous = devices[(selectedIndex - 1 + devices.length) % devices.length]!;
		const next = devices[(selectedIndex + 1) % devices.length]!;

		return { previous, selected, next };
	}

	/**
	 * Resolves the effective active device for idle/details rendering.
	 */
	private async getActiveDevice(): Promise<AudioDevice | null> {
		return this.getCachedDefaultDevice();
	}

	/**
	 * Returns cached scoped device list, loading from native bridge on miss.
	 */
	protected async getCachedAudioDevices(): Promise<AudioDevice[]> {
		return this.audioDevicesCache.getOrLoad(() => this.getAudioDevices());
	}

	/**
	 * Returns cached default device, loading from native bridge on miss.
	 */
	protected async getCachedDefaultDevice(): Promise<AudioDevice | null> {
		return this.defaultDeviceCache.getOrLoad(() => this.getDefaultDevice());
	}

	/**
	 * Invalidates all cached audio reads. Called after writes, native change
	 * notifications, and before timeout-driven return-to-idle renders.
	 */
	protected invalidateDeviceCache(): void {
		this.audioDevicesCache.invalidate();
		this.defaultDeviceCache.invalidate();
	}

	/**
	 * Renders idle state and records the last visible active-device signature to
	 * avoid redundant system-sync re-renders.
	 */
	private async renderIdleAndTrack(
		actionId: string,
		action: DialAction<ActionSettings>,
		device: AudioDevice | null | Promise<AudioDevice | null>,
	): Promise<void> {
		const resolved = await device;
		this.showingDetailsActionIds.delete(actionId);
		await this.renderer.renderIdle(actionId, action, resolved);
		this.lastActiveStateByActionId.set(actionId, deviceStateSignature(resolved, this.noDeviceTitle));
	}
}

function isDialAction(action: unknown): action is DialAction<ActionSettings> {
	return Boolean(
		action &&
		typeof action === "object" &&
		"setFeedback" in action &&
		typeof (action as { setFeedback?: unknown }).setFeedback === "function",
	);
}

function normalizeName(name: string, fallback: string): string {
	const trimmed = name.trim();
	return trimmed || fallback;
}

function deviceStateSignature(device: AudioDevice | null | undefined, fallbackName: string): string {
	if (!device) {
		return `none:${fallbackName}`;
	}

	return [
		device.id,
		normalizeName(device.name, fallbackName),
		device.isDisabled ? "disabled" : "enabled",
		device.isMuted ? "muted" : "unmuted",
	].join("|");
}
