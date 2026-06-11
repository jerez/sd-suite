import { describe, expect, it, vi } from "vitest";

import { createWindowsUsbngAdapter } from "./windows";

describe("createWindowsUsbngAdapter", () => {
	it("enumerates local devices through show-usb-list", async () => {
		const runCommand = vi
			.fn()
			.mockResolvedValue(
				[
					"USB Network Gate",
					"",
					"RootHub#1",
					"    Integrated Camera\t- 1:1",
					"    Port2: Free\t- 1:2",
					"RootHub#2",
					"    USB2.0 Hub",
					"        Razer Tartarus V2\t- 2:1:3",
					"        Razer Laptop Cooling Pad\t- 2:1:4",
				].join("\n"),
			);
		const adapter = createWindowsUsbngAdapter({
			runCommand,
			usbServicePaths: ["C:\\USBNG\\UsbService64.exe"],
		});

		await expect(adapter.listLocalDevices()).resolves.toEqual([
			{ id: "1:1", name: "Integrated Camera" },
			{ id: "2:1:3", name: "Razer Tartarus V2" },
			{ id: "2:1:4", name: "Razer Laptop Cooling Pad" },
		]);
		expect(runCommand).toHaveBeenCalledWith("C:\\USBNG\\UsbService64.exe", ["show-usb-list"]);
	});

	it("refreshes remote names through find-remote-devices for known servers", async () => {
		const runCommand = vi
			.fn()
			.mockResolvedValueOnce(
				[
					"USB Network Gate",
					"",
					"Unknown\t-usbng-server-a.example.test:56228\t-Crypt: disabled\t-Auth: disabled\t-Compressed: disabled\t-disconnected",
					"Unknown\t-198.51.100.24:40353\t-Crypt: disabled\t-Auth: disabled\t-Compressed: disabled\t-disconnected",
				].join("\n"),
			)
			.mockResolvedValueOnce(
				[
					"USB Network Gate",
					"",
					"Stream Deck Plus\t-usbng-server-a.example.test:56228\t-Crypt: disabled\t-Auth: disabled\t-Compressed: disabled\t-connected to 198.51.100.40",
				].join("\n"),
			)
			.mockResolvedValueOnce(
				[
					"USB Network Gate",
					"",
					"Brio 101\t-198.51.100.24:40353\t-Crypt: disabled\t-Auth: disabled\t-Compressed: disabled\t-disconnected",
				].join("\n"),
			);
		const adapter = createWindowsUsbngAdapter({
			runCommand,
			usbServicePaths: ["C:\\USBNG\\UsbService64.exe"],
		});

		await expect(adapter.listRemoteDevices()).resolves.toEqual([
			{
				id: "usbng-server-a.example.test:56228",
				name: "Stream Deck Plus",
				state: "connected",
			},
			{
				id: "198.51.100.24:40353",
				name: "Brio 101",
				state: "remote",
			},
		]);
		expect(runCommand).toHaveBeenNthCalledWith(1, "C:\\USBNG\\UsbService64.exe", ["show-remote-devices"]);
		expect(runCommand).toHaveBeenNthCalledWith(2, "C:\\USBNG\\UsbService64.exe", [
			"find-remote-devices",
			"usbng-server-a.example.test",
		]);
		expect(runCommand).toHaveBeenNthCalledWith(3, "C:\\USBNG\\UsbService64.exe", [
			"find-remote-devices",
			"198.51.100.24",
		]);
	});

	it("shares a local device through share-usb-port", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createWindowsUsbngAdapter({
			runCommand,
			usbServicePaths: ["C:\\USBNG\\UsbService64.exe"],
		});

		await adapter.shareDevice({ id: "2:1:3", name: "Razer Tartarus V2" });

		expect(runCommand).toHaveBeenCalledWith("C:\\USBNG\\UsbService64.exe", ["share-usb-port", "2:1:3"]);
	});

	it("unshares a local device through unshare-usb-port", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createWindowsUsbngAdapter({
			runCommand,
			usbServicePaths: ["C:\\USBNG\\UsbService64.exe"],
		});

		await adapter.unshareDevice({ id: "2:1:3", name: "Razer Tartarus V2" });

		expect(runCommand).toHaveBeenCalledWith("C:\\USBNG\\UsbService64.exe", ["unshare-usb-port", "2:1:3"]);
	});

	it("connects a remote device through connect-remote-device", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createWindowsUsbngAdapter({
			runCommand,
			usbServicePaths: ["C:\\USBNG\\UsbService64.exe"],
		});

		await adapter.connectDevice({
			id: "usbng-server-a.example.test:56228",
			name: "Stream Deck Plus",
			state: "remote",
		});

		expect(runCommand).toHaveBeenCalledWith("C:\\USBNG\\UsbService64.exe", [
			"connect-remote-device",
			"usbng-server-a.example.test:56228",
		]);
	});

	it("disconnects a remote device through disconnect-remote-device", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createWindowsUsbngAdapter({
			runCommand,
			usbServicePaths: ["C:\\USBNG\\UsbService64.exe"],
		});

		await adapter.disconnectDevice({
			id: "usbng-server-a.example.test:56228",
			name: "Stream Deck Plus",
			state: "connected",
		});

		expect(runCommand).toHaveBeenCalledWith("C:\\USBNG\\UsbService64.exe", [
			"disconnect-remote-device",
			"usbng-server-a.example.test:56228",
		]);
	});
});
