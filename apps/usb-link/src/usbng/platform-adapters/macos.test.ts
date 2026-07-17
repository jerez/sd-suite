import { describe, expect, it, vi } from "vitest";

import { createMacosUsbngAdapter } from "./macos";

describe("createMacosUsbngAdapter", () => {
	it("enumerates local devices through eveusbc ls local", async () => {
		const runCommand = vi
			.fn()
			.mockResolvedValue(
				[
					"plugged 32-2.2.1, Brio 101",
					"local 32-2.2.1, bcdUSB 0x200, class 0xe, subclass 0x1, protocol 00, MaxPacketSize 64, vid 0x046d, pid 0x094d, rev 0x9915, product 'Brio 101', manuf. '', serial '2444APW9XTE8', NumConfigurations 1",
				].join("\n"),
			);
		const adapter = createMacosUsbngAdapter({
			runAppleScript: vi.fn(),
			runCommand,
		});

		await expect(adapter.listLocalDevices()).resolves.toEqual([{ id: "32-2.2.1", name: "Brio 101" }]);
		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", ["ls", "local"]);
	});

	it("enumerates remote devices through eveusbc ls net", async () => {
		const runCommand = vi
			.fn()
			.mockResolvedValue(
				[
					"remote 198.51.100.24,,56228,usb3,port1,,Stream Deck Plus,,,,198.51.100.40,,,",
					"connected 198.51.100.24,,60222,usb3,port2,,Brio 101,,,,,,,",
				].join("\n"),
			);
		const adapter = createMacosUsbngAdapter({
			runAppleScript: vi.fn(),
			runCommand,
		});

		await expect(adapter.listRemoteDevices()).resolves.toEqual([
			{
				id: "198.51.100.24,,56228,usb3,port1,,Stream Deck Plus,,,,198.51.100.40,,,",
				name: "Stream Deck Plus",
				state: "remote",
			},
			{
				id: "198.51.100.24,,60222,usb3,port2,,Brio 101,,,,,,,",
				name: "Brio 101",
				state: "connected",
			},
		]);
		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", ["ls", "net"]);
	});

	it("builds a local AppleScript command to share a device", async () => {
		const runAppleScript = vi.fn().mockResolvedValue(undefined);
		const adapter = createMacosUsbngAdapter({
			runAppleScript,
			runCommand: vi.fn(),
		});

		await adapter.shareDevice({ id: "32-2.2.1", name: 'Stream "Deck" Plus' });

		expect(runAppleScript).toHaveBeenCalledWith(
			[
				'tell application "USB Network Gate"',
				'share (first device whose name is "Stream \\"Deck\\" Plus")',
				"end tell",
			].join("\n"),
		);
	});

	it("builds a local AppleScript command to unshare a device", async () => {
		const runAppleScript = vi.fn().mockResolvedValue(undefined);
		const adapter = createMacosUsbngAdapter({
			runAppleScript,
			runCommand: vi.fn(),
		});

		await adapter.unshareDevice({ id: "32-2.2.1", name: "Stream Deck Plus" });

		expect(runAppleScript).toHaveBeenCalledWith(
			[
				'tell application "USB Network Gate"',
				'unshare (first device whose name is "Stream Deck Plus")',
				"end tell",
			].join("\n"),
		);
	});

	it("builds a local AppleScript command to connect to a remote device", async () => {
		const runAppleScript = vi.fn().mockResolvedValue(undefined);
		const adapter = createMacosUsbngAdapter({
			runAppleScript,
			runCommand: vi.fn(),
		});

		await adapter.connectDevice({
			id: "198.51.100.24,,56228,usb3,port1,,Stream Deck Plus,,,,198.51.100.40,,,",
			name: "Stream Deck Plus",
			state: "remote",
		});

		expect(runAppleScript).toHaveBeenCalledWith(
			[
				'tell application "USB Network Gate"',
				'connect to (first remote device whose name is "Stream Deck Plus")',
				"end tell",
			].join("\n"),
		);
	});

	it("builds a local AppleScript command to disconnect from a remote device", async () => {
		const runAppleScript = vi.fn().mockResolvedValue(undefined);
		const adapter = createMacosUsbngAdapter({
			runAppleScript,
			runCommand: vi.fn(),
		});

		await adapter.disconnectDevice({
			id: "198.51.100.24,,60222,usb3,port2,,Brio 101,,,,,,,",
			name: "Brio 101",
			state: "connected",
		});

		expect(runAppleScript).toHaveBeenCalledWith(
			[
				'tell application "USB Network Gate"',
				'disconnect from (first remote device whose name is "Brio 101")',
				"end tell",
			].join("\n"),
		);
	});
});
