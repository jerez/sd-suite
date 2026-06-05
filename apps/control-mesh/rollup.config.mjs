import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import { createRequire } from "node:module";
import path from "node:path";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "dev.jerez.sds.control-mesh.sdPlugin";
const require = createRequire(import.meta.url);
const sdpiComponentsEntry = require.resolve("@workspace/sdpi-components/sdpi-components.js");

/**
 * Creates a source-map path transformer compatible with Stream Deck's local
 * plugin runtime.
 */
function createSourcemapPathTransform() {
	return (relativeSourcePath, sourcemapPath) => {
		return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
	};
}

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: {
		"bin/plugin": "src/plugin.ts",
		"ui/control-mesh-setup": "src/property-inspector/control-mesh-setup.ts",
		"ui/execute-remote-action": "src/property-inspector/execute-remote-action.ts",
		"ui/sdpi-components": sdpiComponentsEntry,
	},
	output: {
		dir: sdPlugin,
		chunkFileNames: "ui/[name]-[hash].js",
		entryFileNames: "[name].js",
		format: "es",
		sourcemap: isWatching,
		sourcemapPathTransform: createSourcemapPathTransform(),
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
				this.addWatchFile(`${sdPlugin}/ui/control-mesh-setup.html`);
				this.addWatchFile(`${sdPlugin}/ui/execute-remote-action.html`);
			},
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined,
		}),
		json(),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
		}),
		commonjs(),
		!isWatching && terser(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "bin/package.json", source: `{ "type": "module" }`, type: "asset" });
			},
		},
	],
};

export default config;
