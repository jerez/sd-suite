import type { AudioDevice } from "./types";

/**
 * Platform adapter contract for querying and updating the system's default
 * audio device (output or input).
 *
 * Both platform implementations (`mac` and `windows`) must expose this exact
 * signature to keep the switching logic platform-agnostic.
 */
export interface AudioDeviceApi {
	/**
	 * Lists currently available devices.
	 */
	getAudioDevices(): Promise<AudioDevice[]>;

	/**
	 * Gets the current default device.
	 */
	getDefaultDevice(): Promise<AudioDevice | null>;

	/**
	 * Sets the current default device by id.
	 */
	setDefaultDevice(deviceId: string): Promise<void>;

	/**
	 * Subscribes to native default-device changes.
	 *
	 * Implementations should invoke `listener` whenever the OS default
	 * device changes outside this plugin. Returns a cleanup function.
	 */
	subscribeDefaultDeviceChanges(listener: () => void): Promise<() => void>;
}
