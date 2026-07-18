import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { AudioDeviceApi } from "./contracts";
import type { AudioDevice } from "./types";

type AudioScope = "output" | "input";
type BridgeAction = "query" | "set";

const execFileAsync = promisify(execFile);

const NATIVE_POWERSHELL_RELATIVE_PATH = path.join("native", "windows", "audio-bridge.ps1");
const PROJECT_NATIVE_POWERSHELL_RELATIVE_PATH = path.join(
  "dev.jerez.sds.audio-source.sdPlugin",
  NATIVE_POWERSHELL_RELATIVE_PATH,
);

const windowsBridgeScriptPath = resolveNativeWindowsBridgePath();

function createWindowsAudioDeviceApi(scope: AudioScope): AudioDeviceApi {
  return {
    getAudioDevices: async () => {
      const response = await runWindowsBridge(scope, "query");
      return response.devices;
    },
    getDefaultDevice: async () => {
      const response = await runWindowsBridge(scope, "query");
      if (!response.defaultId) {
        return null;
      }

      return response.devices.find((device) => device.id === response.defaultId) ?? null;
    },
    setDefaultDevice: async (deviceId: string) => {
      await runWindowsBridge(scope, "set", deviceId);
    },
    subscribeDefaultDeviceChanges: async (listener: () => void) => {
      const watcher = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          windowsBridgeScriptPath,
        ],
        {
          env: {
            ...process.env,
            SD_AUDIO_ACTION: "watch",
            SD_AUDIO_DEVICE_ID: "",
            SD_AUDIO_FLOW: scope,
          },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      bindWatcherOutput(watcher, listener);

      return () => {
        if (!watcher.killed) {
          watcher.kill();
        }
      };
    },
  };
}

/**
 * Executes the PowerShell/C# bridge and parses its JSON response.
 */
async function runWindowsBridge(
  scope: AudioScope,
  action: BridgeAction,
  deviceId?: string,
): Promise<BridgeResponse> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      windowsBridgeScriptPath,
    ],
    {
      env: {
        ...process.env,
        SD_AUDIO_ACTION: action,
        SD_AUDIO_DEVICE_ID: deviceId ?? "",
        SD_AUDIO_FLOW: scope,
      },
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    },
  );

  const text = stdout.trim();
  if (!text) {
    throw new Error("Windows audio bridge returned an empty response.");
  }

  return parseBridgeResponse(text);
}

/**
 * Resolves the PowerShell bridge location from packaged-plugin and workspace
 * layouts.
 */
function resolveNativeWindowsBridgePath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "..", NATIVE_POWERSHELL_RELATIVE_PATH),
    path.resolve(process.cwd(), NATIVE_POWERSHELL_RELATIVE_PATH),
    path.resolve(process.cwd(), PROJECT_NATIVE_POWERSHELL_RELATIVE_PATH),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Windows native bridge file not found. Tried: ${candidates.join(", ")}`);
}

/**
 * Binds stdout/stderr handlers to a watcher process and emits listener calls
 * for normalized `changed` messages.
 */
function bindWatcherOutput(watcher: ReturnType<typeof spawn>, listener: () => void): void {
  let buffer = "";
  if (!watcher.stdout) {
    return;
  }

  watcher.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line === "changed") {
        listener();
      }

      newlineIndex = buffer.indexOf("\n");
    }
  });

  watcher.stderr?.on("data", () => {});
}

/**
 * Parses the bridge JSON payload from stdout.
 */
function parseBridgeResponse(stdout: string): BridgeResponse {
  const line = stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .at(-1);

  if (!line) {
    throw new Error("Windows audio bridge response is missing JSON output.");
  }

  const parsed = JSON.parse(line) as Partial<BridgeResponse>;
  const devices = Array.isArray(parsed.devices) ? parsed.devices : [];

  return {
    devices: devices
      .filter(
        (item): item is AudioDevice =>
          typeof item?.id === "string" && typeof item?.name === "string",
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        formFactor: item.formFactor,
        transportType: item.transportType,
        isDisabled: typeof item.isDisabled === "boolean" ? item.isDisabled : undefined,
        isMuted: typeof item.isMuted === "boolean" ? item.isMuted : undefined,
      })),
    defaultId: typeof parsed.defaultId === "string" ? parsed.defaultId : null,
  };
}

/**
 * Raw bridge response shape emitted by the PowerShell bridge.
 */
interface BridgeResponse {
  devices: AudioDevice[];
  defaultId: string | null;
}

/**
 * Windows implementation of the shared audio-device contracts.
 */
export const audioOutputApi: AudioDeviceApi = createWindowsAudioDeviceApi("output");
export const audioInputApi: AudioDeviceApi = createWindowsAudioDeviceApi("input");
