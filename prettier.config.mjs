export default {
	endOfLine: "lf",
	printWidth: 120,
	semi: true,
	singleQuote: false,
	trailingComma: "all",
	useTabs: true,
	overrides: [
		{
			files: "*.jsonc",
			options: {
				trailingComma: "none",
			},
		},
		{
			files: ["*.json", "*.jsonc", "*.md"],
			options: {
				tabWidth: 4,
				useTabs: false,
			},
		},
		{
			files: ["*.yaml", "*.yml"],
			options: {
				tabWidth: 2,
				useTabs: false,
			},
		},
	],
};
