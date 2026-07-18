import { beforeEach, describe, expect, it, vi } from "vitest";
import { InputDeviceSwitcher } from "./input-device-switcher";

vi.mock("../audio", () => ({
  getAudioInputDevices: vi.fn(),
  getDefaultInputDevice: vi.fn(),
  setDefaultInputDevice: vi.fn(),
  refreshInputDevices: vi.fn(),
}));

import {
  getAudioInputDevices,
  getDefaultInputDevice,
  refreshInputDevices,
  setDefaultInputDevice,
} from "../audio";

describe("InputDeviceSwitcher", () => {
  let switcher: InputDeviceSwitcher;

  beforeEach(() => {
    switcher = new InputDeviceSwitcher();
    vi.clearAllMocks();
    vi.mocked(getAudioInputDevices).mockResolvedValue([
      { id: "mic-1", name: "Built-in Microphone" },
      { id: "mic-2", name: "USB Mic" },
    ]);
    vi.mocked(getDefaultInputDevice).mockResolvedValue({
      id: "mic-1",
      name: "Built-in Microphone",
    });
    vi.mocked(setDefaultInputDevice).mockResolvedValue();
    vi.mocked(refreshInputDevices).mockResolvedValue();
  });

  it("initializes using input refresh function", async () => {
    const result = await switcher.initialize("action-1");
    expect(result).toBe("Built-in Microphone");
  });

  it("previews input devices", async () => {
    const preview = await switcher.preview("action-1", 1);
    expect(preview).toEqual({ selectedId: "mic-2", selectedName: "USB Mic", direction: 1 });
  });

  it("confirms selected input device", async () => {
    await switcher.preview("action-1", 1);
    await switcher.confirm("action-1");
    expect(setDefaultInputDevice).toHaveBeenCalledWith("mic-2");
  });

  it("uses No Input fallback when default is missing", async () => {
    vi.mocked(getDefaultInputDevice).mockResolvedValue(null);
    const active = await switcher.getActiveName();
    expect(active).toBe("No Input");
  });
});

