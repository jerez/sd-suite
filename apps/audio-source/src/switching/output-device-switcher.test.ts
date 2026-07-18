import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutputDeviceSwitcher } from "./output-device-switcher";
import type { AudioDevice } from "../audio/types";

// Mock the audio facade
vi.mock("../audio", () => ({
  getAudioDevices: vi.fn(),
  getDefaultDevice: vi.fn(),
  setDefaultDevice: vi.fn(),
  refreshDevices: vi.fn(),
}));

import { getAudioDevices, getDefaultDevice, refreshDevices, setDefaultDevice } from "../audio";

describe("OutputDeviceSwitcher", () => {
  let switcher: OutputDeviceSwitcher;
  const mockDevices: AudioDevice[] = [
    { id: "device-1", name: "Speakers" },
    { id: "device-2", name: "Headphones" },
    { id: "device-3", name: "USB Audio" },
  ];

  beforeEach(() => {
    switcher = new OutputDeviceSwitcher();
    vi.clearAllMocks();
  });

  describe("initialize", () => {
    it("should refresh devices and return active device name", async () => {
      vi.mocked(getDefaultDevice).mockResolvedValue(mockDevices[0]!);
      vi.mocked(refreshDevices).mockResolvedValue();

      const result = await switcher.initialize("action-1");

      expect(result).toBe("Speakers");
    });

    it('should return "No Output" when no default device exists', async () => {
      vi.mocked(getDefaultDevice).mockResolvedValue(null);
      vi.mocked(refreshDevices).mockResolvedValue();

      const result = await switcher.initialize("action-1");

      expect(result).toBe("No Output");
    });
  });

  describe("preview", () => {
    beforeEach(() => {
      vi.mocked(getAudioDevices).mockResolvedValue(mockDevices);
      vi.mocked(getDefaultDevice).mockResolvedValue(mockDevices[0]!);
    });

    it("should return null for zero ticks", async () => {
      const result = await switcher.preview("action-1", 0);
      expect(result).toBeNull();
    });

    it("should rotate forward by one device", async () => {
      const result = await switcher.preview("action-1", 1);

      expect(result).toEqual({
        selectedId: "device-2",
        selectedName: "Headphones",
        direction: 1,
      });
    });

    it("should rotate backward by one device", async () => {
      const result = await switcher.preview("action-1", -1);

      expect(result).toEqual({
        selectedId: "device-3",
        selectedName: "USB Audio",
        direction: -1,
      });
    });

    it("should rotate forward multiple ticks", async () => {
      const result = await switcher.preview("action-1", 3);

      expect(result).toEqual({
        selectedId: "device-1",
        selectedName: "Speakers",
        direction: 1,
      });
    });

    it("should wrap around when rotating forward", async () => {
      await switcher.preview("action-1", 2); // Move to USB Audio
      const result = await switcher.preview("action-1", 1);

      expect(result).toEqual({
        selectedId: "device-1",
        selectedName: "Speakers",
        direction: 1,
      });
    });

    it("should wrap around when rotating backward", async () => {
      const result = await switcher.preview("action-1", -1);

      expect(result).toEqual({
        selectedId: "device-3",
        selectedName: "USB Audio",
        direction: -1,
      });
    });

    it("should handle empty device list", async () => {
      vi.mocked(getAudioDevices).mockResolvedValue([]);

      const result = await switcher.preview("action-1", 1);

      expect(result).toEqual({
        selectedId: "none",
        selectedName: "No Output",
        direction: 1,
      });
    });

    it("should maintain separate state for different action IDs", async () => {
      await switcher.preview("action-1", 1); // Move to Headphones
      await switcher.preview("action-2", 2); // Move to USB Audio

      const result1 = await switcher.preview("action-1", 0);
      const result2 = await switcher.preview("action-2", 0);

      // Both should maintain their positions
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe("confirm", () => {
    beforeEach(() => {
      vi.mocked(getAudioDevices).mockResolvedValue(mockDevices);
      vi.mocked(getDefaultDevice).mockResolvedValue(mockDevices[0]!);
      vi.mocked(setDefaultDevice).mockResolvedValue();
      vi.mocked(refreshDevices).mockResolvedValue();
    });

    it("should apply previewed selection", async () => {
      await switcher.preview("action-1", 1); // Preview Headphones

      const result = await switcher.confirm("action-1");

      expect(setDefaultDevice).toHaveBeenCalledWith("device-2");
      expect(result.changed).toBe(true);
    });

    it("should return changed false when no preview exists", async () => {
      const result = await switcher.confirm("action-1");

      expect(setDefaultDevice).not.toHaveBeenCalled();
      expect(result.changed).toBe(false);
    });

    it("should clear pending state after confirm", async () => {
      await switcher.preview("action-1", 1);
      await switcher.confirm("action-1");

      // Second confirm should not change anything
      const result = await switcher.confirm("action-1");

      expect(setDefaultDevice).toHaveBeenCalledTimes(1); // Only first confirm
      expect(result.changed).toBe(false);
    });
  });

  describe("revert", () => {
    beforeEach(() => {
      vi.mocked(getAudioDevices).mockResolvedValue(mockDevices);
      vi.mocked(getDefaultDevice).mockResolvedValue(mockDevices[1]!);
      vi.mocked(refreshDevices).mockResolvedValue();
    });

    it("should clear preview and return active device", async () => {
      await switcher.preview("action-1", 2); // Move away from default

      const result = await switcher.revert("action-1");

      expect(result).toBe("Headphones");
    });

    it("should not call setDefaultDevice", async () => {
      await switcher.preview("action-1", 1);
      await switcher.revert("action-1");

      expect(setDefaultDevice).not.toHaveBeenCalled();
    });
  });

  describe("getActiveName", () => {
    it("should return normalized device name", async () => {
      vi.mocked(getDefaultDevice).mockResolvedValue({
        id: "device-1",
        name: "  Speakers  ",
      });

      const result = await switcher.getActiveName();

      expect(result).toBe("Speakers");
    });

    it('should return "No Output" when device is null', async () => {
      vi.mocked(getDefaultDevice).mockResolvedValue(null);

      const result = await switcher.getActiveName();

      expect(result).toBe("No Output");
    });
  });

  describe("clear", () => {
    it("should remove pending state for specific action", async () => {
      vi.mocked(getAudioDevices).mockResolvedValue(mockDevices);
      vi.mocked(getDefaultDevice).mockResolvedValue(mockDevices[0]!);

      await switcher.preview("action-1", 1);
      switcher.clear("action-1");

      const result = await switcher.confirm("action-1");

      expect(result.changed).toBe(false);
    });
  });
});
