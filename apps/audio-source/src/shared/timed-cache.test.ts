import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimedCache } from "./timed-cache";

describe("TimedCache", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns cached value while TTL is valid", async () => {
		const cache = new TimedCache<number>(1_000);
		const loader = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(20);

		const first = await cache.getOrLoad(loader);
		const second = await cache.getOrLoad(loader);

		expect(first).toBe(10);
		expect(second).toBe(10);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("reloads after TTL expiration", async () => {
		const cache = new TimedCache<number>(1_000);
		const loader = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(20);

		const first = await cache.getOrLoad(loader);
		vi.advanceTimersByTime(1_001);
		const second = await cache.getOrLoad(loader);

		expect(first).toBe(10);
		expect(second).toBe(20);
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("invalidates and reloads immediately", async () => {
		const cache = new TimedCache<number>(60_000);
		const loader = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(20);

		const first = await cache.getOrLoad(loader);
		cache.invalidate();
		const second = await cache.getOrLoad(loader);

		expect(first).toBe(10);
		expect(second).toBe(20);
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("deduplicates concurrent in-flight loads", async () => {
		const cache = new TimedCache<number>(60_000);
		let resolveLoader: (value: number) => void = () => {
			throw new Error("resolveLoader was used before initialization");
		};
		const loader = vi.fn(
			() =>
				new Promise<number>((resolve) => {
					resolveLoader = resolve;
				}),
		);

		const firstPromise = cache.getOrLoad(loader);
		const secondPromise = cache.getOrLoad(loader);

		expect(loader).toHaveBeenCalledTimes(1);
		resolveLoader(42);

		await expect(firstPromise).resolves.toBe(42);
		await expect(secondPromise).resolves.toBe(42);
	});

	it("does not keep failed load results", async () => {
		const cache = new TimedCache<number>(60_000);
		const loader = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(7);

		await expect(cache.getOrLoad(loader)).rejects.toThrow("boom");
		await expect(cache.getOrLoad(loader)).resolves.toBe(7);
		expect(loader).toHaveBeenCalledTimes(2);
	});
});
