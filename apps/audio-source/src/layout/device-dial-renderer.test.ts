import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DialAction } from "@elgato/streamdeck";

import { DeviceDialRenderer } from "./device-dial-renderer";

type DialTestAction = DialAction<Record<string, never>>;

describe("DeviceDialRenderer", () => {
  let renderer: DeviceDialRenderer;

  beforeEach(() => {
    renderer = new DeviceDialRenderer({
      layout: "layouts/output-device.json",
      noDeviceTitle: "No Device",
      iconScope: "output",
    });
  });

  it("applies the configured layout", async () => {
    const mockAction = {
      setFeedbackLayout: vi.fn().mockResolvedValue(undefined),
    };

    await renderer.applyLayout(mockAction);
    expect(mockAction.setFeedbackLayout).toHaveBeenCalledWith("layouts/output-device.json");
  });

  it("renders fallback idle label when device is null", async () => {
    const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
    const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

    await renderer.renderIdle("action-1", mockAction, null);

    const payload = setFeedbackMock.mock.calls[0]![0];
    expect(payload.idleLabel.value).toBe("No Device");
    expect(payload.idleIcon.enabled).toBe(true);
    expect(payload.confirmLabel.enabled).toBe(false);
  });

  it("renders confirm payload", async () => {
    const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
    const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

    await renderer.renderConfirm("action-1", mockAction, "USB Mic");

    const payload = setFeedbackMock.mock.calls[0]![0];
    expect(payload.confirmLabel.value).toBe("✓ USB Mic");
    expect(payload.idleIcon.enabled).toBe(false);
    expect(payload.browseCenterIcon.enabled).toBe(false);
  });

  it("renders details payload with transport + device labels", async () => {
    const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
    const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

    await renderer.renderDetails("action-1", mockAction, {
      id: "1",
      name: "USB DAC",
      transportType: "usb",
      formFactor: "line-out",
    });

    const payload = setFeedbackMock.mock.calls[0]![0];
    expect(payload.detailTransportIcon.enabled).toBe(true);
    expect(payload.detailTransportLabel.value).toBe("USB");
    expect(payload.detailDeviceLabel.value).toBe("USB DAC");
    expect(payload.idleIcon.enabled).toBe(false);
    expect(payload.browseCenterIcon.enabled).toBe(false);
    expect(payload.confirmLabel.enabled).toBe(false);
  });

  it("keeps disabled idle labels as plain text", async () => {
    const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
    const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

    await renderer.renderIdle("action-1", mockAction, {
      id: "1",
      name: "Disabled Device",
      isDisabled: true,
    });

    const payload = setFeedbackMock.mock.calls[0]![0];
    expect(payload.idleLabel.value).toBe("Disabled Device");
  });

  it("keeps muted idle labels as plain text", async () => {
    const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
    const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

    await renderer.renderIdle("action-1", mockAction, {
      id: "1",
      name: "Muted Device",
      isMuted: true,
    });

    const payload = setFeedbackMock.mock.calls[0]![0];
    expect(payload.idleLabel.value).toBe("Muted Device");
  });
});
