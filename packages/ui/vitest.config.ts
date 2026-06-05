import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
		include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
	},
});
