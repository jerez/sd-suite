import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DialAction } from "@elgato/streamdeck";

import { InputDeviceDialRenderer } from "./input-device-dial-renderer";

type DialTestAction = DialAction<Record<string, never>>;

describe("InputDeviceDialRenderer", () => {
  let renderer: InputDeviceDialRenderer;

  beforeEach(() => {
    renderer = new InputDeviceDialRenderer();
  });

  it("uses the shared encoder layout", async () => {
    const mockAction = {
      setFeedbackLayout: vi.fn().mockResolvedValue(undefined),
    };

    await renderer.applyLayout(mockAction);
    expect(mockAction.setFeedbackLayout).toHaveBeenCalledWith("layouts/output-device.json");
  });

  it("uses No Input fallback title", async () => {
    const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
    const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

    await renderer.renderIdle("action-1", mockAction, null);

    const payload = setFeedbackMock.mock.calls[0]![0];
    expect(payload.idleLabel.value).toBe("No Input");
  });
});
