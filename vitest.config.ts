import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				"**/node_modules/**",
				"**/dist/**",
				"**/coverage/**",
				"**/*.sdPlugin/**",
				"**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
			],
			include: [
				"apps/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
				"packages/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
				"tools/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
			],
			provider: "v8",
			reportsDirectory: "coverage",
			reporter: ["text", "html", "lcov"],
		},
		environment: "node",
		exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/*.sdPlugin/**"],
		include: ["tools/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
	},
});
