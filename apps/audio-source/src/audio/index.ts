import type { AudioDeviceApi } from "./contracts";
import { audioInputApi as macAudioInputApi, audioOutputApi as macAudioOutputApi } from "./mac";
import {
  audioInputApi as windowsAudioInputApi,
  audioOutputApi as windowsAudioOutputApi,
} from "./windows";
import type { AudioDevice } from "./types";

export type { AudioDevice } from "./types";

export type { AudioDeviceApi } from "./contracts";

export type AudioScope = "output" | "input";

type ScopedApis = {
  output: AudioDeviceApi;
  input: AudioDeviceApi;
};

const platformApis = resolvePlatformApis();

function getApi(scope: AudioScope): AudioDeviceApi {
  return scope === "input" ? platformApis.input : platformApis.output;
}

/**
 * Returns all currently available devices for a specific audio scope.
 */
export async function getScopedAudioDevices(scope: AudioScope): Promise<AudioDevice[]> {
  return getApi(scope).getAudioDevices();
}

/**
 * Returns the currently active default device for a specific audio scope.
 */
export async function getScopedDefaultDevice(scope: AudioScope): Promise<AudioDevice | null> {
  return getApi(scope).getDefaultDevice();
}

/**
 * Sets the default device for a specific audio scope by id.
 */
export async function setScopedDefaultDevice(scope: AudioScope, deviceId: string): Promise<void> {
  await getApi(scope).setDefaultDevice(deviceId);
}

/**
 * Subscribes to native default-device changes for a specific audio scope.
 */
export async function subscribeScopedDefaultDeviceChanges(
  scope: AudioScope,
  listener: () => void,
): Promise<() => void> {
  return getApi(scope).subscribeDefaultDeviceChanges(listener);
}

/**
 * Refreshes device and default-device data for a specific scope.
 */
export async function refreshScopedDevices(scope: AudioScope): Promise<void> {
  const api = getApi(scope);
  await Promise.all([api.getAudioDevices(), api.getDefaultDevice()]);
}

/**
 * Returns all currently available output devices from the active platform.
 */
export async function getAudioDevices(): Promise<AudioDevice[]> {
  return getScopedAudioDevices("output");
}

/**
 * Returns the currently active default output device.
 */
export async function getDefaultDevice(): Promise<AudioDevice | null> {
  return getScopedDefaultDevice("output");
}

/**
 * Sets the default output device by id.
 */
export async function setDefaultDevice(deviceId: string): Promise<void> {
  await setScopedDefaultDevice("output", deviceId);
}

/**
 * Subscribes to native default-output changes from the active platform.
 */
export async function subscribeDefaultDeviceChanges(listener: () => void): Promise<() => void> {
  return subscribeScopedDefaultDeviceChanges("output", listener);
}

/**
 * Refreshes device and default-device data from the platform adapter.
 *
 * This function intentionally discards values because the side-effect is to
 * force fresh reads from both adapter endpoints.
 */
export async function refreshDevices(): Promise<void> {
  await refreshScopedDevices("output");
}

/**
 * Returns all currently available input devices from the active platform.
 */
export async function getAudioInputDevices(): Promise<AudioDevice[]> {
  return getScopedAudioDevices("input");
}

/**
 * Returns the currently active default input device.
 */
export async function getDefaultInputDevice(): Promise<AudioDevice | null> {
  return getScopedDefaultDevice("input");
}

/**
 * Sets the default input device by id.
 */
export async function setDefaultInputDevice(deviceId: string): Promise<void> {
  await setScopedDefaultDevice("input", deviceId);
}

/**
 * Subscribes to native default-input changes from the active platform.
 */
export async function subscribeDefaultInputDeviceChanges(
  listener: () => void,
): Promise<() => void> {
  return subscribeScopedDefaultDeviceChanges("input", listener);
}

/**
 * Refreshes input-device and default-input data from the platform adapter.
 */
export async function refreshInputDevices(): Promise<void> {
  await refreshScopedDevices("input");
}

/**
 * Resolves the OS-specific audio adapter.
 */
function resolvePlatformApis(): ScopedApis {
  if (process.platform === "win32") {
    return {
      output: windowsAudioOutputApi,
      input: windowsAudioInputApi,
    };
  }

  if (process.platform === "darwin") {
    return {
      output: macAudioOutputApi,
      input: macAudioInputApi,
    };
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}
