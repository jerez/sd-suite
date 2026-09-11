import { describe, expect, it, vi } from "vitest";

import { createMacosUsbngAdapter, runCommandWithClosedStdin } from "./macos";

describe("createMacosUsbngAdapter", () => {
	it("closes stdin for CLI commands", async () => {
		const waitForEof = 'process.stdin.on("end", () => process.stdout.write("ready")); process.stdin.resume();';

		await expect(runCommandWithClosedStdin(process.execPath, ["-e", waitForEof])).resolves.toBe("ready");
	});

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
			runCommand,
		});

		await expect(adapter.listRemoteDevices()).resolves.toEqual([
			{
				id: "198.51.100.24:56228",
				name: "Stream Deck Plus",
				state: "remote",
			},
			{
				id: "198.51.100.24:60222",
				name: "Brio 101",
				state: "connected",
			},
		]);
		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", ["ls", "net"]);
	});

	it("discovers remote devices on an explicit server through eveusbc explore", async () => {
		const runCommand = vi
			.fn()
			.mockResolvedValue("remote usbng-server.example.test,,56228,usb3,port1,,Stream Deck Plus,,,,,,,\n");
		const adapter = createMacosUsbngAdapter({ runCommand });

		await expect(adapter.listRemoteDevices("usbng-server.example.test")).resolves.toEqual([
			{
				id: "usbng-server.example.test:56228",
				name: "Stream Deck Plus",
				state: "remote",
			},
		]);
		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", [
			"explore",
			"usbng-server.example.test",
		]);
	});

	it("lists shared local devices through eveusbc ls shared", async () => {
		const runCommand = vi.fn().mockResolvedValue("shared ,,3300,usb3,3-1,,Stream Deck Plus,,,,,,,\n");
		const adapter = createMacosUsbngAdapter({
			runCommand,
		});

		await expect(adapter.listSharedDevices()).resolves.toEqual([{ id: "3-1", name: "Stream Deck Plus" }]);
		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", ["ls", "shared"]);
	});

	it("shares the selected device id and keeps the automation process alive while USB Network Gate stabilizes", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createMacosUsbngAdapter({
			runCommand,
		});

		await adapter.shareDevice({ id: "3-1", name: 'Stream "Deck" Plus' });

		expect(runCommand).toHaveBeenCalledOnce();
		expect(runCommand).toHaveBeenCalledWith("osascript", [
			"-e",
			['tell application "USB Network Gate"', "share (first device whose id is 51380224)", "end tell", "delay 3"].join(
				"\n",
			),
		]);
	});

	it("unshares a local device through eveusbc", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createMacosUsbngAdapter({
			runCommand,
		});

		await adapter.unshareDevice({ id: "32-2.2.1", name: "Stream Deck Plus" });

		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", [
			"unshare",
			"32-2.2.1",
		]);
	});

	it("connects to a remote device through eveusbc", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createMacosUsbngAdapter({
			runCommand,
		});

		await adapter.connectDevice({
			id: "198.51.100.24:56228",
			name: "Stream Deck Plus",
			state: "remote",
		});

		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", [
			"connect",
			"198.51.100.24:56228",
		]);
	});

	it("disconnects from a remote device through eveusbc", async () => {
		const runCommand = vi.fn().mockResolvedValue("");
		const adapter = createMacosUsbngAdapter({
			runCommand,
		});

		await adapter.disconnectDevice({
			id: "198.51.100.24:60222",
			name: "Brio 101",
			state: "connected",
		});

		expect(runCommand).toHaveBeenCalledWith("/Library/Frameworks/EveUSB.framework/Support/eveusbc", [
			"disconnect",
			"198.51.100.24:60222",
		]);
	});
});
