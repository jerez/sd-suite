import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
	it("merges conditional classes and resolves Tailwind conflicts", () => {
		const disabled = false;

		expect(cn("px-2", disabled && "hidden", ["px-4", "text-sm"])).toBe("px-4 text-sm");
	});
});
