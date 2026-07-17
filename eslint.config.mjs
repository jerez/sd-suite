import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
	{
		ignores: [
			".tmp/**",
			".worktrees/**",
			".turbo/**",
			"**/.pnpm-store/**",
			"pnpm-lock.yaml",
			"coverage/**",
			"dist/**",
			"node_modules/**",
			"packages/sdpi-components/dist/**",
			"**/*.sdPlugin/ui/*.js",
			"**/*.sdPlugin/bin/**",
			"**/*.sdPlugin/logs/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			"no-duplicate-imports": "error",
			"sort-imports": [
				"error",
				{
					allowSeparatedGroups: true,
					ignoreCase: true,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
				},
			],
		},
	},
	eslintConfigPrettier,
];
