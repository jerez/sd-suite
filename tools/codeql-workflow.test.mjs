import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/codeql.yml"), "utf8");
const ciWorkflow = readFileSync(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
const releaseWorkflow = readFileSync(path.join(repositoryRoot, ".github/workflows/release-audio-source.yml"), "utf8");

describe("CodeQL workflow", () => {
	it("uses Node-based pnpm instead of the standalone executable", () => {
		expect(workflow).toContain("standalone: false");
		expect(workflow).not.toContain("standalone: true");
	});

	it("prepares the Swift toolchain before tracing the package-local native build", () => {
		const nodeSetup = workflow.indexOf("uses: actions/setup-node@v5");
		const pnpmSetup = workflow.indexOf("uses: pnpm/action-setup@v4");
		const dependencyInstall = workflow.indexOf("run: pnpm install --frozen-lockfile");
		const codeqlInit = workflow.indexOf("uses: github/codeql-action/init@v4");
		const nativeBuild = workflow.indexOf("run: pnpm native:build --filter=audio-source");

		expect(nodeSetup).toBeGreaterThan(-1);
		expect(pnpmSetup).toBeGreaterThan(nodeSetup);
		expect(dependencyInstall).toBeGreaterThan(pnpmSetup);
		expect(codeqlInit).toBeGreaterThan(dependencyInstall);
		expect(nativeBuild).toBeGreaterThan(codeqlInit);
	});

	it("uses the root Turbo task for current-platform native builds", () => {
		for (const candidate of [workflow, ciWorkflow, releaseWorkflow]) {
			expect(candidate).not.toMatch(/^\s*run: pnpm --filter audio-source native:build\s*$/mu);
		}

		expect(workflow).toContain("run: pnpm native:build --filter=audio-source");
		expect(ciWorkflow.match(/run: pnpm native:build --filter=audio-source/gu)).toHaveLength(2);
		expect(releaseWorkflow).toContain("run: pnpm native:build --filter=audio-source");
	});
});
