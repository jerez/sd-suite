import { beforeEach, describe, expect, it, vi } from "vitest";

const streamDeckMocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@elgato/streamdeck", () => ({
	SingletonAction: class {},
	streamDeck: { logger: streamDeckMocks },
}));

import { CycleAudioDeviceAction, type CycleAudioDeviceActionOptions } from "./cycle-audio-device-action";

class TestCycleAudioDeviceAction extends CycleAudioDeviceAction {
	constructor(options: CycleAudioDeviceActionOptions) {
		super(options);
	}
}

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function createDialAction(id: string) {
	return {
		id,
		setFeedback: vi.fn(),
		setTitle: vi.fn(),
	};
}

function createSubject(subscription: Promise<() => void>) {
	const subscribeDefaultDeviceChanges = vi.fn(() => subscription);
	const renderIdle = vi.fn(async () => {});
	const subject = new TestCycleAudioDeviceAction({
		noDeviceTitle: "No Output",
		switcher: {
			initialize: vi.fn(async () => "device"),
			clear: vi.fn(),
			preview: vi.fn(),
			confirm: vi.fn(),
			revert: vi.fn(),
		},
		renderer: {
			applyLayout: vi.fn(async () => {}),
			clear: vi.fn(),
			renderIdle,
			renderBrowse: vi.fn(async () => {}),
			renderConfirm: vi.fn(async () => {}),
			renderDetails: vi.fn(async () => {}),
		},
		getAudioDevices: vi.fn(async () => []),
		getDefaultDevice: vi.fn(async () => null),
		subscribeDefaultDeviceChanges,
	});

	return { subject, subscribeDefaultDeviceChanges, renderIdle };
}

async function waitForSubscription(subscribeDefaultDeviceChanges: ReturnType<typeof vi.fn>): Promise<void> {
	for (let attempt = 0; attempt < 10 && subscribeDefaultDeviceChanges.mock.calls.length === 0; attempt++) {
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
	if (subscribeDefaultDeviceChanges.mock.calls.length === 0) {
		throw new Error("Subscription did not start.");
	}
}

async function waitForCalls(mock: ReturnType<typeof vi.fn>, count: number): Promise<void> {
	for (let attempt = 0; attempt < 10 && mock.mock.calls.length < count; attempt++) {
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
	if (mock.mock.calls.length < count) {
		throw new Error(`Expected ${count} calls, received ${mock.mock.calls.length}.`);
	}
}

beforeEach(() => {
	streamDeckMocks.error.mockReset();
});

describe("CycleAudioDeviceAction native subscription lifecycle", () => {
	it("stops a subscription that becomes ready after the final dial disappears", async () => {
		const deferred = createDeferred<() => void>();
		const stop = vi.fn();
		const { subject, subscribeDefaultDeviceChanges } = createSubject(deferred.promise);
		const action = createDialAction("dial-1");

		const appearance = subject.onWillAppear({ action } as never);
		await waitForSubscription(subscribeDefaultDeviceChanges);
		subject.onWillDisappear({ action } as never);
		deferred.resolve(stop);
		await appearance;

		expect(stop).toHaveBeenCalledOnce();
	});

	it("retains the pending subscription when another dial appears", async () => {
		const deferred = createDeferred<() => void>();
		const stop = vi.fn();
		const { subject, subscribeDefaultDeviceChanges, renderIdle } = createSubject(deferred.promise);
		const firstAction = createDialAction("dial-1");
		const secondAction = createDialAction("dial-2");

		const firstAppearance = subject.onWillAppear({ action: firstAction } as never);
		await waitForSubscription(subscribeDefaultDeviceChanges);
		subject.onWillDisappear({ action: firstAction } as never);
		const secondAppearance = subject.onWillAppear({ action: secondAction } as never);
		await waitForCalls(renderIdle, 2);
		await new Promise<void>((resolve) => setImmediate(resolve));
		deferred.resolve(stop);
		await Promise.all([firstAppearance, secondAppearance]);

		expect(subscribeDefaultDeviceChanges).toHaveBeenCalledOnce();
		expect(stop).not.toHaveBeenCalled();

		subject.onWillDisappear({ action: secondAction } as never);
		expect(stop).toHaveBeenCalledOnce();
	});
});
