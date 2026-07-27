import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workflowPath = new URL("../.github/workflows/release.yml", import.meta.url);

describe("release workflow", () => {
	it("does not gate every package on aggregate native matrix success", async () => {
		const workflow = await readFile(workflowPath, "utf8");

		expect(workflow).toContain("continue-on-error: true");
		expect(workflow).not.toContain("needs.native.result != 'failure'");
		expect(workflow).toContain("needs.plan.result == 'success'");
	});

	it("requires every declared native platform artifact before packaging a plugin", async () => {
		const workflow = await readFile(workflowPath, "utf8");

		expect(workflow).toContain("EXPECTED_NATIVE_PLATFORMS: ${{ toJSON(matrix.release.nativePlatforms) }}");
		expect(workflow).toContain("Missing native release output for $platform");
	});

	it("continues only when GitHub reports that a release does not exist", async () => {
		const workflow = await readFile(workflowPath, "utf8");

		expect(workflow).toContain('if [[ "$status" == "404" ]]');
		expect(workflow).toContain("Unable to verify GitHub Release");
	});
});
