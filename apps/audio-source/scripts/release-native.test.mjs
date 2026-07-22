import { describe, expect, it } from "vitest";
import { releaseNativeSteps } from "./release-native.mjs";

describe("release native orchestration", () => {
	it("builds and validates a universal macOS bridge before testing it", () => {
		expect(releaseNativeSteps("darwin")).toEqual([
			["build-native.mjs", "--universal"],
			["validate-native.mjs", "--universal"],
			["test-native.mjs"],
		]);
	});

	it("builds, validates, and integration-tests the Windows bridge", () => {
		expect(releaseNativeSteps("win32")).toEqual([
			["build-native.mjs"],
			["validate-native.mjs"],
			["test-native.mjs"],
			["test-native-windows-integration.mjs"],
		]);
	});

	it("rejects unsupported release build hosts", () => {
		expect(() => releaseNativeSteps("linux")).toThrow("Unsupported native release platform: linux");
	});
});
