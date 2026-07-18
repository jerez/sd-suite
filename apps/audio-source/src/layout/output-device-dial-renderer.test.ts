import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DialAction } from "@elgato/streamdeck";

import type { AudioDevice } from "../audio/types";
import { OutputDeviceDialRenderer } from "./output-device-dial-renderer";

type DialTestAction = DialAction<Record<string, never>>;

describe("OutputDeviceDialRenderer", () => {
  let renderer: OutputDeviceDialRenderer;

  beforeEach(() => {
    renderer = new OutputDeviceDialRenderer();
  });

  describe("applyLayout", () => {
    it("sets the expected feedback layout", async () => {
      const mockAction = {
        setFeedbackLayout: vi.fn().mockResolvedValue(undefined),
      };

      await renderer.applyLayout(mockAction);

      expect(mockAction.setFeedbackLayout).toHaveBeenCalledWith("layouts/output-device.json");
    });
  });

  describe("renderIdle", () => {
    it("renders idle icon + label payload for dial actions", async () => {
      const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
      const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;
      const device: AudioDevice = {
        id: "1",
        name: "Headphones",
        formFactor: "headphones",
        transportType: "bluetooth",
      };

      await renderer.renderIdle("action-1", mockAction, device);

      const payload = setFeedbackMock.mock.calls[0]![0];
      expect(payload.idleIcon.enabled).toBe(true);
      expect(payload.idleIcon.value).toContain("data:image/svg+xml;utf8,");
      expect(payload.idleLabel.value).toBe("Headphones");
      expect(payload.browsePrevIcon.enabled).toBe(false);
      expect(payload.confirmLabel.enabled).toBe(false);
    });

    it("does not include unsupported color property in label", async () => {
      const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
      const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

      await renderer.renderIdle("action-1", mockAction, {
        id: "1",
        name: "Monitor",
        formFactor: "hdmi",
        transportType: "usb",
      });

      const payload = setFeedbackMock.mock.calls[0]![0];
      expect(payload.idleLabel.color).toBeUndefined();
    });
  });

  describe("renderBrowse", () => {
    it("renders three-icon carousel and selected label", async () => {
      const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
      const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

      await renderer.renderBrowse("action-1", mockAction, {
        previous: {
          id: "1",
          name: "USB DAC",
          formFactor: "line-out",
          transportType: "usb",
        },
        selected: {
          id: "2",
          name: "Headphones",
          formFactor: "headphones",
          transportType: "bluetooth",
        },
        next: { id: "3", name: "Monitor", formFactor: "hdmi", transportType: "built-in" },
        scope: "output",
      });

      const payload = setFeedbackMock.mock.calls[0]![0];
      expect(payload.browsePrevIcon.enabled).toBe(true);
      expect(payload.browseCenterIcon.enabled).toBe(true);
      expect(payload.browseNextIcon.enabled).toBe(true);
      expect(payload.browsePrevIcon.opacity).toBe(0.5);
      expect(payload.browseNextIcon.opacity).toBe(0.5);
      expect(payload.browseLabel.value).toBe("Headphones");
      expect(payload.idleIcon.enabled).toBe(false);
      expect(payload.confirmLabel.enabled).toBe(false);
    });
  });

  describe("renderConfirm", () => {
    it("renders confirmation label for dial actions", async () => {
      const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
      const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

      await renderer.renderConfirm("action-1", mockAction, "LG Monitor");

      const payload = setFeedbackMock.mock.calls[0]![0];
      expect(payload.confirmLabel.enabled).toBe(true);
      expect(payload.confirmLabel.value).toBe("✓ LG Monitor");
      expect(payload.idleIcon.enabled).toBe(false);
      expect(payload.browseCenterIcon.enabled).toBe(false);
    });
  });

  describe("clear", () => {
    it("keeps renderer stable after clearing state", async () => {
      const setFeedbackMock = vi.fn().mockResolvedValue(undefined);
      const mockAction = { setFeedback: setFeedbackMock } as unknown as DialTestAction;

      renderer.clear("action-1");
      await renderer.renderIdle("action-1", mockAction, { id: "1", name: "Speakers" });

      const payload = setFeedbackMock.mock.calls[0]![0];
      expect(payload.idleLabel.value).toBe("Speakers");
    });
  });
});

