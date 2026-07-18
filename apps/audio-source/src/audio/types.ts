/**
 * Device form factor describing the physical type of audio output.
 */
export type DeviceFormFactor =
	| "headphones"
	| "speakers"
	| "line-out"
	| "digital"
	| "spdif"
	| "hdmi"
	| "displayport"
	| "unknown";

/**
 * Transport type describing how the device connects to the system.
 */
export type DeviceTransportType =
	| "built-in"
	| "usb"
	| "bluetooth"
	| "wireless"
	| "thunderbolt"
	| "firewire"
	| "pci"
	| "virtual"
	| "aggregate"
	| "airplay"
	| "unknown";

/**
 * Normalized audio output device descriptor used across all modules.
 */
export interface AudioDevice {
	/**
	 * Stable platform-specific identifier for the device.
	 */
	id: string;

	/**
	 * Human-readable device name shown in the UI.
	 */
	name: string;

	/**
	 * Physical form factor of the device (what it is).
	 * Optional - may not be available on all platforms.
	 */
	formFactor?: DeviceFormFactor;

	/**
	 * Connection/transport type (how it connects).
	 * Optional - may not be available on all platforms.
	 */
	transportType?: DeviceTransportType;

	/**
	 * Whether the endpoint is currently disabled/unavailable in the OS.
	 * Optional because not all platform bridges can determine this state.
	 */
	isDisabled?: boolean;

	/**
	 * Whether the endpoint is currently muted in the OS.
	 * Optional because not all platform bridges can determine this state.
	 */
	isMuted?: boolean;
}
