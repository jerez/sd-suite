/**
 * Small generic time-based cache with explicit invalidation.
 *
 * Values are served from memory while fresh, and concurrent misses share a
 * single in-flight load to avoid duplicate upstream work.
 */
export class TimedCache<T> {
	private value: T | undefined;
	private updatedAt = 0;
	private inFlight: Promise<T> | null = null;
	private readonly ttlMs: number;

	/**
	 * @param ttlMs Max age of cached values in milliseconds.
	 */
	constructor(ttlMs: number) {
		this.ttlMs = ttlMs;
	}

	/**
	 * Returns a cached value when fresh; otherwise loads, stores, and returns.
	 * Multiple concurrent misses are deduplicated into one loader call.
	 */
	async getOrLoad(loader: () => Promise<T>): Promise<T> {
		if (this.isFresh()) {
			return this.value as T;
		}

		// Share one pending promise across concurrent cache misses.
		if (this.inFlight) {
			return this.inFlight;
		}

		// Promote freshly loaded value to cache on successful completion.
		this.inFlight = loader()
			.then((loaded) => {
				this.value = loaded;
				this.updatedAt = Date.now();
				return loaded;
			})
			.finally(() => {
				this.inFlight = null;
			});

		return this.inFlight;
	}

	/**
	 * Clears cached value and in-flight state.
	 */
	invalidate(): void {
		this.value = undefined;
		this.updatedAt = 0;
		this.inFlight = null;
	}

	/**
	 * Returns true when a cached value exists and is still within the TTL window.
	 */
	private isFresh(): boolean {
		if (this.value === undefined) {
			return false;
		}

		return Date.now() - this.updatedAt < this.ttlMs;
	}
}
