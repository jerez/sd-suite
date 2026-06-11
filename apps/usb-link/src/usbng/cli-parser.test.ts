import { describe, expect, it } from "vitest";

import { parseLocalUsbngDevices, parseNetworkUsbngDevices } from "./cli-parser";

describe("parseLocalUsbngDevices", () => {
	it("parses local device ids and names from eveusbc output", () => {
		const output = [
			"plugged 32-2.2.1, Brio 101",
			"local 32-2.2.1, bcdUSB 0x200, class 0xe, subclass 0x1, protocol 00, MaxPacketSize 64, vid 0x046d, pid 0x094d, rev 0x9915, product 'Brio 101', manuf. '', serial '2444APW9XTE8', NumConfigurations 1",
			"plugged 32-2.2.2, LG UltraGear GP9",
			"local 32-2.2.2, bcdUSB 0x200, class 0xef, subclass 0x2, protocol 0x1, MaxPacketSize 64, vid 0x0495, pid 0x1050, rev 0x0001, product 'LG UltraGear GP9', manuf. 'LG', serial '', NumConfigurations 2",
		].join("\n");

		expect(parseLocalUsbngDevices(output)).toEqual([
			{ id: "32-2.2.1", name: "Brio 101" },
			{ id: "32-2.2.2", name: "LG UltraGear GP9" },
		]);
	});
});

describe("parseNetworkUsbngDevices", () => {
	it("parses named remote and connected devices from eveusbc output", () => {
		const output = [
			"disconnected 198.51.100.24,,46165,usb3,port1,,,,,,,,,",
			"remote 198.51.100.24,,56228,usb3,port1,,Stream Deck Plus,,,,198.51.100.40,,,",
			"connected 198.51.100.24,,60222,usb3,port2,,Brio 101,,,,,,,",
		].join("\n");

		expect(parseNetworkUsbngDevices(output)).toEqual([
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
	});
});
