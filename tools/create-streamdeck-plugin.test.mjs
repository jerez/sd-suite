import * as path from "node:path";
import {
	buildContext,
	createPlugin,
	mapTemplateName,
	normalizePluginName,
	parseArgs,
	relativePath,
	titleCase,
} from "./create-streamdeck-plugin.mjs";
import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("create-streamdeck-plugin helpers", () => {
	it("parses plugin creation options", () => {
		expect(
			parseArgs([
				"control-mesh",
				"--dry-run",
				"--author",
				"Jane Developer",
				"--description",
				"Secure mesh controls.",
				"--display-name",
				"Control Mesh",
				"--root",
				"/workspace",
			]),
		).toEqual({
			author: "Jane Developer",
			description: "Secure mesh controls.",
			displayName: "Control Mesh",
			dryRun: true,
			help: false,
			pluginName: "control-mesh",
			root: "/workspace",
		});
	});

	it("rejects plugin names that cannot become Stream Deck identifiers", () => {
		expect(() => normalizePluginName("ControlMesh")).toThrow(
			"Plugin name must be kebab-case with lowercase letters, numbers, and single hyphen separators.",
		);
		expect(() => normalizePluginName("control--mesh")).toThrow(
			"Plugin name must be kebab-case with lowercase letters, numbers, and single hyphen separators.",
		);
	});

	it("derives display and template names for the monorepo layout", () => {
		const context = { sdPluginDirName: "dev.jerez.sds.control-mesh.sdPlugin" };

		expect(titleCase("control-mesh")).toBe("Control Mesh");
		expect(mapTemplateName("com.elgato.template.sdPlugin", context)).toBe("dev.jerez.sds.control-mesh.sdPlugin");
		expect(mapTemplateName("_.gitignore", context)).toBe(".gitignore");
		expect(mapTemplateName("manifest.json.ejs", context)).toBe("manifest.json");
	});

	it("uses dot for unchanged relative paths", () => {
		expect(relativePath("/workspace", "/workspace")).toBe(".");
	});

	it("creates a plugin scaffold from the pinned Elgato template", async () => {
		const rootDir = await mkdtemp(path.join(tmpdir(), "sd-suite-plugin-test-"));

		try {
			await mkdir(path.join(rootDir, "docs"), { recursive: true });
			await writeFile(
				path.join(rootDir, "package.json"),
				`${JSON.stringify({
					name: "sd-suite",
					devDependencies: {
						"@elgato/cli": "1.7.4",
						"@types/node": "~24.12.4",
						typescript: "^5.2.2",
					},
				})}\n`,
			);
			await writeFile(path.join(rootDir, "docs", "control-mesh.md"), "# Control Mesh\n");

			const context = await buildContext(parseArgs(["control-mesh", "--root", rootDir]));
			const result = await createPlugin(context);
			const appDir = path.join(rootDir, "apps", "control-mesh");
			const packageJson = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8"));
			const manifest = JSON.parse(
				await readFile(path.join(appDir, "dev.jerez.sds.control-mesh.sdPlugin", "manifest.json"), "utf8"),
			);
			const readmePath = path.join(appDir, "README.md");
			const readme = await readFile(readmePath, "utf8");

			expect(result).toEqual({ readmePath });
			expect(readme).toContain("# Control Mesh");
			expect(readme).toContain("Package: `control-mesh`");
			expect(readme).toContain("Plugin UUID: `dev.jerez.sds.control-mesh`");
			expect(readme).toContain("Plugin folder: `dev.jerez.sds.control-mesh.sdPlugin`");
			expect(readme).toContain("Declare shipped changes from the workspace root with `pnpm changeset`.");
			expect(await readFile(path.join(rootDir, "docs", "control-mesh.md"), "utf8")).toBe("# Control Mesh\n");
			await expect(readFile(path.join(appDir, "docs", "brief.md"), "utf8")).rejects.toThrow();
			expect(packageJson).toMatchObject({
				name: "control-mesh",
				private: true,
				scripts: {
					build: "rollup -c",
					validate: "streamdeck validate dev.jerez.sds.control-mesh.sdPlugin --no-update-check",
					pack: "streamdeck pack dev.jerez.sds.control-mesh.sdPlugin --no-update-check",
				},
				dependencies: {
					"@elgato/streamdeck": "2.1.0",
				},
			});
			expect(packageJson.devDependencies["@tsconfig/node20"]).toBeUndefined();
			expect(manifest.UUID).toBe("dev.jerez.sds.control-mesh");
			expect(manifest.Name).toBe("Control Mesh");
		} finally {
			await rm(rootDir, { force: true, recursive: true });
		}
	});
});
