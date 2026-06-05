import { describe, expect, it, vi } from "vitest";

import { createPairingApprovalBroker } from "./pairing-approval-broker";

describe("createPairingApprovalBroker", () => {
	it("rejects approval requests when the setup property inspector is not visible", async () => {
		const broker = createPairingApprovalBroker({ sendToPropertyInspector: vi.fn() });

		await expect(
			broker.requestApproval({
				endpoint: "http://desk.local:38765",
				executorEnabled: false,
				node: { nodeId: "node-a", nodeName: "Desk" },
			}),
		).resolves.toEqual({
			error: "Open Control Mesh Setup on this peer to approve pairing.",
			ok: false,
		});
	});

	it("resolves an approval request after the property inspector approves it", async () => {
		const sendToPropertyInspector = vi.fn();
		const broker = createPairingApprovalBroker({ sendToPropertyInspector, timeoutMs: 1000 });
		broker.setVisible(true);

		const pendingApproval = broker.requestApproval({
			endpoint: "http://desk.local:38765",
			executorEnabled: false,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});
		const requestId = sendToPropertyInspector.mock.calls[0]?.[0]?.requestId as string;

		broker.approve(requestId);

		await expect(pendingApproval).resolves.toEqual({ ok: true });
		expect(sendToPropertyInspector).toHaveBeenCalledWith({
			endpoint: "http://desk.local:38765",
			nodeId: "node-a",
			nodeName: "Desk",
			requestId,
			type: "pairingRequestReceived",
		});
	});

	it("rejects an approval request after the property inspector rejects it", async () => {
		const sendToPropertyInspector = vi.fn();
		const broker = createPairingApprovalBroker({ sendToPropertyInspector, timeoutMs: 1000 });
		broker.setVisible(true);

		const pendingApproval = broker.requestApproval({
			endpoint: "http://desk.local:38765",
			executorEnabled: false,
			node: { nodeId: "node-a", nodeName: "Desk" },
		});
		const requestId = sendToPropertyInspector.mock.calls[0]?.[0]?.requestId as string;

		broker.reject(requestId);

		await expect(pendingApproval).resolves.toEqual({
			error: "Pairing rejected.",
			ok: false,
		});
	});
});
