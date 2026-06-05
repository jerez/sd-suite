import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultControlMeshSettings } from "../settings/control-mesh-settings";

import {
	executeConfiguredRemoteAction,
	ExecuteRemoteAction,
	handleExecuteRemoteActionPropertyInspectorMessage,
} from "./execute-remote-action";

describe("executeConfiguredRemoteAction", () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it("executes a configured remote action through the peer client", async () => {
		const peerClient = { execute: vi.fn(async () => ({ ok: true as const, result: { done: true } })) };

		const result = await executeConfiguredRemoteAction(
			{
				actionId: "lights.on",
				targetNodeId: "studio",
			},
			{
				createPeerClient: () => peerClient,
				resolvePeerConnection: () => ({
					localNodeId: "node-a",
					secret: "shared-secret",
					url: "http://studio.local:38765",
				}),
			},
		);

		expect(result).toEqual({ ok: true, result: { done: true } });
		expect(peerClient.execute).toHaveBeenCalledWith("lights.on");
	});

	it("returns a structured error when peer settings cannot be resolved", async () => {
		const result = await executeConfiguredRemoteAction(
			{
				actionId: "lights.on",
				targetNodeId: "studio",
			},
			{
				createPeerClient: () => ({ execute: vi.fn() }),
				resolvePeerConnection: () => undefined,
			},
		);

		expect(result).toEqual({ error: "Peer connection is not configured.", ok: false });
	});

	it("returns only trusted peers for the target dropdown", async () => {
		const settings = {
			...createDefaultControlMeshSettings("node-a"),
			knownPeers: [
				{
					connection: { state: "untested" as const },
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				},
				{
					connection: { state: "untested" as const },
					displayName: "Desk",
					endpoints: ["http://desk.local:38765"],
					nodeId: "desk",
				},
			],
			trustLinks: [
				{
					createdAt: "2026-06-02T00:00:00.000Z",
					enabled: true,
					remoteNodeId: "studio",
					secretVersion: 1,
					sharedSecret: "shared-secret",
				},
			],
		};

		const result = await handleExecuteRemoteActionPropertyInspectorMessage(
			{ event: "getTrustedPeers" },
			{
				createPeerClient: () => ({ listActions: vi.fn() }),
				getActionSettings: () => ({}),
				getGlobalSettings: () => settings,
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			event: "getTrustedPeers",
			items: [{ label: "Studio", value: "studio" }],
		});
	});

	it("returns remote actions for the selected trusted peer", async () => {
		const globalSettings = {
			...createDefaultControlMeshSettings("node-a"),
			knownPeers: [
				{
					connection: { state: "untested" as const },
					displayName: "Studio",
					endpoints: ["http://studio.local:38765"],
					nodeId: "studio",
				},
			],
		};
		const listActions = vi.fn(async () => [
			{
				description: "Turns the studio lights on.",
				id: "lights.on",
				name: "Website",
				title: "Juanna Ink",
			},
			{
				id: "lights.off",
				name: "Timer",
			},
		]);

		const result = await handleExecuteRemoteActionPropertyInspectorMessage(
			{ event: "getRemoteActions" },
			{
				createPeerClient: () => ({ listActions }),
				getActionSettings: () => ({ targetNodeId: "studio" }),
				getGlobalSettings: () => globalSettings,
				resolvePeerConnection: () => ({
					localNodeId: "node-a",
					secret: "shared-secret",
					url: "http://studio.local:38765",
				}),
			},
		);

		expect(listActions).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			event: "getRemoteActions",
			actionDescriptions: {
				"lights.off": "Studio: Timer",
				"lights.on": "Studio: Turns the studio lights on.",
			},
			items: [
				{ label: "Studio: Juanna Ink", value: "lights.on" },
				{ label: "Studio: Timer", value: "lights.off" },
			],
		});
	});

	it("returns a disabled remote-action item until a trusted peer is selected", async () => {
		const result = await handleExecuteRemoteActionPropertyInspectorMessage(
			{ event: "getRemoteActions" },
			{
				createPeerClient: () => ({ listActions: vi.fn() }),
				getActionSettings: () => ({}),
				getGlobalSettings: () => createDefaultControlMeshSettings("node-a"),
				resolvePeerConnection: vi.fn(),
			},
		);

		expect(result).toEqual({
			event: "getRemoteActions",
			items: [{ disabled: true, label: "Select a trusted peer first.", value: "" }],
		});
	});

	it("uses custom feedback images and restores the default image after success", async () => {
		vi.useFakeTimers();

		const setImage = vi.fn(async () => undefined);
		const action = new ExecuteRemoteAction({
			createPeerClient: () =>
				({
					execute: vi.fn(async () => ({ ok: true as const, result: { done: true } })),
				}) as never,
			runtime: {
				resolvePeerConnection: () =>
					Promise.resolve({
						localNodeId: "node-a",
						secret: "shared-secret",
						url: "http://studio.local:38765",
					}),
			},
		});

		await action.onKeyDown({
			action: { setImage },
			payload: {
				settings: {
					actionId: "lights.on",
					targetNodeId: "studio",
				},
			},
		} as never);

		expect(setImage).toHaveBeenNthCalledWith(1, "imgs/actions/execute-remote-action/key-active.svg");
		expect(setImage).toHaveBeenNthCalledWith(2, "imgs/actions/execute-remote-action/key-success.svg");

		await vi.advanceTimersByTimeAsync(1_200);

		expect(setImage).toHaveBeenNthCalledWith(3, undefined);
	});

	it("shows a Stream Deck alert on failure and cancels stale restore timers on repeated presses", async () => {
		vi.useFakeTimers();

		const setImage = vi.fn(async () => undefined);
		const showAlert = vi.fn(async () => undefined);
		let attempt = 0;
		const action = new ExecuteRemoteAction({
			createPeerClient: () =>
				({
					execute: vi.fn(async () => {
						attempt += 1;
						return attempt === 1 ? { error: "boom", ok: false as const } : { ok: true as const, result: {} };
					}),
				}) as never,
			runtime: {
				resolvePeerConnection: () =>
					Promise.resolve({
						localNodeId: "node-a",
						secret: "shared-secret",
						url: "http://studio.local:38765",
					}),
			},
		});

		const event = {
			action: { setImage, showAlert },
			payload: {
				settings: {
					actionId: "lights.on",
					targetNodeId: "studio",
				},
			},
		} as never;

		await action.onKeyDown(event);
		await vi.advanceTimersByTimeAsync(600);
		await action.onKeyDown(event);
		await vi.advanceTimersByTimeAsync(1_199);

		expect(setImage).toHaveBeenCalledWith("imgs/actions/execute-remote-action/key-error.svg");
		expect(setImage).toHaveBeenCalledWith("imgs/actions/execute-remote-action/key-success.svg");
		expect(showAlert).toHaveBeenCalledTimes(1);
		expect(setImage).not.toHaveBeenCalledWith(undefined);

		await vi.advanceTimersByTimeAsync(1);

		expect(setImage).toHaveBeenLastCalledWith(undefined);
	});
});
