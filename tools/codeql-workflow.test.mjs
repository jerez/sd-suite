import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/codeql.yml"), "utf8");
const ciWorkflow = readFileSync(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
const releaseWorkflow = readFileSync(path.join(repositoryRoot, ".github/workflows/release-audio-source.yml"), "utf8");

describe("CodeQL workflow", () => {
	it("keeps pull-request analysis buildless", () => {
		expect(workflow).toContain("language: javascript-typescript");
		expect(workflow).toContain("language: csharp");
		expect(workflow.match(/build-mode: none/gu)).toHaveLength(2);
		expect(workflow).not.toContain("language: swift");
		expect(workflow).not.toContain("native:build");
	});

	it("keeps native compilation out of normal CI", () => {
		expect(ciWorkflow).not.toContain("native:build");
		expect(ciWorkflow).not.toContain("native-macos:");
		expect(ciWorkflow).not.toContain("native-windows:");
	});

	it("traces Swift compilation in the explicit release workflow", () => {
		const codeqlInit = releaseWorkflow.indexOf("uses: github/codeql-action/init@v4");
		const macosBuild = releaseWorkflow.indexOf("run: pnpm --filter audio-source native:build:release");
		const codeqlAnalyze = releaseWorkflow.indexOf("uses: github/codeql-action/analyze@v4");

		expect(releaseWorkflow).toContain("languages: swift");
		expect(releaseWorkflow).toContain("build-mode: manual");
		expect(codeqlInit).toBeGreaterThan(-1);
		expect(macosBuild).toBeGreaterThan(codeqlInit);
		expect(codeqlAnalyze).toBeGreaterThan(macosBuild);
		expect(releaseWorkflow).toContain("run: pnpm native:build --filter=audio-source");
	});
});
