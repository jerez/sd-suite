import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(packageRoot, "native/windows/Program.cs"), "utf8");

function interfaceBody(name) {
	const match = source.match(new RegExp(`public interface ${name} \\{([\\s\\S]*?)^\\}`, "mu"));
	if (!match) throw new Error(`Missing ${name} declaration.`);
	return match[1];
}

function methodNames(name) {
	return [...interfaceBody(name).matchAll(/\bint\s+(\w+)\s*\(/gu)].map((match) => match[1]);
}

function interfaceGuid(name) {
	const match = source.match(
		new RegExp(`\\[Guid\\("([^"]+)"\\)\\]\\s*\\[InterfaceType\\([^\\]]+\\)\\]\\s*public interface ${name}\\b`, "u"),
	);
	if (!match) throw new Error(`Missing ${name} GUID declaration.`);
	return match[1];
}

describe("Windows COM interop source contract", () => {
	it("declares IMMDeviceEnumerator in native vtable order exactly once", () => {
		expect(source.match(/public interface IMMDeviceEnumerator\b/gu)).toHaveLength(1);
		expect(methodNames("IMMDeviceEnumerator")).toEqual([
			"EnumAudioEndpoints",
			"GetDefaultAudioEndpoint",
			"GetDevice",
			"RegisterEndpointNotificationCallback",
			"UnregisterEndpointNotificationCallback",
		]);
	});

	it("uses the Windows SDK IID for IMMDeviceCollection", () => {
		expect(interfaceGuid("IMMDeviceCollection")).toBe("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E");
	});

	it("places SetDefaultEndpoint after ten IPolicyConfig vtable methods", () => {
		const methods = methodNames("IPolicyConfig");
		expect(methods.indexOf("SetDefaultEndpoint")).toBe(10);
	});

	it("preserves HRESULT signatures on every imported COM interface method", () => {
		const interfaces = [
			"IMMDeviceEnumerator",
			"IMMDevice",
			"IMMDeviceCollection",
			"IAudioEndpointVolume",
			"IPropertyStore",
			"IMMNotificationClient",
			"IPolicyConfig",
		];

		for (const name of interfaces) {
			const methods = interfaceBody(name).match(/^\s*(?:\[[^\]]+\]\s*)*int\s+\w+\s*\([^;]*\);/gmu) ?? [];
			expect(methods, `${name} should declare HRESULT methods`).not.toHaveLength(0);
			for (const method of methods) {
				expect(method, `${name}: ${method.trim()}`).toMatch(/\[PreserveSig\]/u);
			}
		}
	});

	it("copies readonly property keys before passing them by reference", () => {
		expect(source).not.toMatch(/GetValue\(ref PKEY_/u);
	});
});
