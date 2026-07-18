import type { AudioDevice } from "../audio/types";

/**
 * Per-action in-progress selection state while the dial is being rotated.
 */
type PendingSelection = {
  deviceIds: string[];
  selectedIndex: number;
};

/**
 * Preview payload returned after a rotate gesture.
 */
export type PreviewSelection = {
  /**
   * Stable selected device id used by the caller to build adjacent preview UI
   * without recomputing rotation state.
   */
  selectedId: string;
  /**
   * Human-readable selected device name for direct rendering.
   */
  selectedName: string;
  direction: 1 | -1;
};

/**
 * Confirmation result returned after push-to-confirm.
 */
export type ConfirmResult = {
  activeName: string;
  changed: boolean;
};

export type DeviceSwitcherApi = {
  getAudioDevices(): Promise<AudioDevice[]>;
  getDefaultDevice(): Promise<AudioDevice | null>;
  setDefaultDevice(deviceId: string): Promise<void>;
  refreshDevices(): Promise<void>;
};

export type DeviceSwitcherOptions = {
  api: DeviceSwitcherApi;
  noDeviceTitle: string;
};

/**
 * Platform-agnostic service that owns device switching behavior.
 */
export class DeviceSwitcher {
  private readonly pendingByActionId = new Map<string, PendingSelection>();
  private readonly api: DeviceSwitcherApi;
  private readonly noDeviceTitle: string;

  constructor(options: DeviceSwitcherOptions) {
    this.api = options.api;
    this.noDeviceTitle = options.noDeviceTitle;
  }

  /**
   * Initializes switching state for a specific action instance.
   */
  async initialize(actionId: string): Promise<string> {
    this.clear(actionId);
    return this.getActiveName();
  }

  /**
   * Clears transient preview state for an action instance.
   */
  clear(actionId: string): void {
    this.pendingByActionId.delete(actionId);
  }

  /**
   * Returns the normalized active device name.
   */
  async getActiveName(): Promise<string> {
    const currentDevice = await this.api.getDefaultDevice();
    return this.normalizeName(currentDevice?.name ?? this.noDeviceTitle);
  }

  /**
   * Advances preview selection from dial rotation ticks without applying a
   * system-level device change.
   *
   * This reads the default device only when pending state must be initialized
   * or when the device list identity has changed.
   */
  async preview(actionId: string, ticks: number): Promise<PreviewSelection | null> {
    if (ticks === 0) {
      return null;
    }

    // Device list can change independently from dial events.
    const devices = await this.api.getAudioDevices();

    if (devices.length === 0) {
      this.clear(actionId);
      return {
        selectedId: "none",
        selectedName: this.noDeviceTitle,
        direction: ticks > 0 ? 1 : -1,
      };
    }

    const state = await this.getOrCreatePendingSelection(actionId, devices);
    const direction: 1 | -1 = ticks > 0 ? 1 : -1;
    const steps = Math.abs(ticks);

    // Apply one-step rotation per hardware tick to preserve wrap behavior.
    for (let step = 0; step < steps; step += 1) {
      state.selectedIndex = (state.selectedIndex + direction + devices.length) % devices.length;
    }

    const selectedId = state.deviceIds[state.selectedIndex]!;
    const selectedDevice =
      devices.find((device) => device.id === selectedId) ?? devices[state.selectedIndex];

    return {
      selectedId: selectedDevice?.id ?? selectedId,
      selectedName: this.normalizeName(selectedDevice?.name ?? this.noDeviceTitle),
      direction,
    };
  }

  /**
   * Applies the currently previewed device selection, if any.
   */
  async confirm(actionId: string): Promise<ConfirmResult> {
    const pending = this.pendingByActionId.get(actionId);
    let changed = false;

    if (pending) {
      const selectedId = pending.deviceIds[pending.selectedIndex];
      this.clear(actionId);

      if (selectedId) {
        await this.api.setDefaultDevice(selectedId);
        changed = true;
      }
    }

    return {
      activeName: await this.getActiveName(),
      changed,
    };
  }

  /**
   * Discards any preview state and returns to the active system device.
   */
  async revert(actionId: string): Promise<string> {
    this.clear(actionId);
    return this.getActiveName();
  }

  /**
   * Gets existing pending selection or initializes one from the current
   * default device.
   */
  private async getOrCreatePendingSelection(
    actionId: string,
    devices: Array<{ id: string }>,
  ): Promise<PendingSelection> {
    const deviceIds = devices.map((device) => device.id);
    const existing = this.pendingByActionId.get(actionId);

    // Reuse selection state while the device ordering is stable.
    if (existing && this.arraysEqual(existing.deviceIds, deviceIds)) {
      return existing;
    }

    // Only read the system default when we must initialize/reset state.
    const currentDefault = await this.api.getDefaultDevice();

    const defaultIndex = currentDefault
      ? deviceIds.findIndex((id) => id === currentDefault.id)
      : -1;

    const created: PendingSelection = {
      deviceIds,
      selectedIndex: defaultIndex >= 0 ? defaultIndex : 0,
    };

    this.pendingByActionId.set(actionId, created);
    return created;
  }

  /**
   * Normalizes display labels, ensuring empty names fall back to the
   * configured no-device title.
   */
  private normalizeName(name: string): string {
    const trimmed = name.trim();
    return trimmed || this.noDeviceTitle;
  }

  /**
   * Compares two ordered string arrays for exact equality.
   */
  private arraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
  }
}
