import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { createRequire } from "node:module";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "dev.jerez.sds.usb-link.sdPlugin";
const require = createRequire(import.meta.url);
const sdpiComponentsEntry = require.resolve("@workspace/sdpi-components/sdpi-components.js");

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
		"ui/share-device": "src/property-inspector/share-device.ts",
		"ui/unshare-device": "src/property-inspector/unshare-device.ts",
		"ui/connect-device": "src/property-inspector/connect-device.ts",
		"ui/disconnect-device": "src/property-inspector/disconnect-device.ts",
		"ui/sdpi-components": sdpiComponentsEntry,
	},
	output: {
		chunkFileNames: "ui/[name]-[hash].js",
		dir: sdPlugin,
		entryFileNames: "[name].js",
		format: "es",
		sourcemap: isWatching,
		sourcemapPathTransform: createSourcemapPathTransform(),
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart() {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
				this.addWatchFile(`${sdPlugin}/ui/share-device.html`);
				this.addWatchFile(`${sdPlugin}/ui/unshare-device.html`);
				this.addWatchFile(`${sdPlugin}/ui/connect-device.html`);
				this.addWatchFile(`${sdPlugin}/ui/disconnect-device.html`);
			},
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined,
		}),
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
