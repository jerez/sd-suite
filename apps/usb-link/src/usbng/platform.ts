import { createMacosUsbngAdapter } from "./platform-adapters/macos";
import { createWindowsUsbngAdapter } from "./platform-adapters/windows";
import type { UsbngPlatformAdapter } from "./platform-adapter";

/**
 * Dependency injection hooks for selecting the platform-specific USBNG adapter.
 */
export type CreateUsbngPlatformAdapterOptions = {
	createMacosAdapter?: () => UsbngPlatformAdapter;
	createWindowsAdapter?: () => UsbngPlatformAdapter;
	platform?: NodeJS.Platform;
};

/**
 * Creates the adapter that matches the current Node.js runtime platform.
 */
export function createUsbngPlatformAdapter(options: CreateUsbngPlatformAdapterOptions = {}): UsbngPlatformAdapter {
	const platform = options.platform ?? process.platform;

	if (platform === "darwin") {
		return options.createMacosAdapter?.() ?? createMacosUsbngAdapter();
	}

	if (platform === "win32" && options.createWindowsAdapter) {
		return options.createWindowsAdapter();
	}

	if (platform === "win32") {
		return createWindowsUsbngAdapter();
	}

	throw new Error(`USB Link does not support ${platform}.`);
}
