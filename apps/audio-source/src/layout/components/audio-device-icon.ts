import {
  AudioLines,
  Cpu,
  Headphones,
  Mic,
  MicOff,
  Monitor,
  Speaker,
  Volume2,
  VolumeOff,
} from "lucide";

import type { DeviceFormFactor, DeviceTransportType } from "../../audio/types";

type IconNode = Array<[string, Record<string, string | number | undefined>]>;
type IconAttributes = Record<string, string | number | undefined>;

export type DeviceIconScope = "output" | "input";

const ICON_STROKE = "#FFFFFF";

const EXTERNAL_OUTPUT_TRANSPORTS: ReadonlySet<DeviceTransportType> = new Set([
  "usb",
  "bluetooth",
  "wireless",
  "thunderbolt",
  "firewire",
  "pci",
  "virtual",
  "aggregate",
  "airplay",
]);

const FORM_FACTOR_ICONS: Record<DeviceFormFactor, IconNode> = {
  headphones: Headphones,
  speakers: Speaker,
  "line-out": AudioLines,
  digital: Cpu,
  spdif: AudioLines,
  hdmi: Monitor,
  displayport: Monitor,
  unknown: Volume2,
};

/**
 * Props for `AudioDeviceIcon`.
 */
export type AudioDeviceIconProps = {
  formFactor?: DeviceFormFactor;
  transportType?: DeviceTransportType;
  isDisabled?: boolean;
  isMuted?: boolean;
  scope?: DeviceIconScope;
  size: number;
  strokeWidth?: number;
};

/**
 * Renders a themed device icon as SVG string.
 */
export function renderAudioDeviceIcon(props: AudioDeviceIconProps): string {
  const iconNode = resolveIconNode(props);
  const iconMarkup = iconNode
    .map(([tag, attrs]) => {
      const attrsMarkup = Object.entries(attrs as IconAttributes)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(" ");
      return `<${tag} ${attrsMarkup}></${tag}>`;
    })
    .join("");

  const strokeWidth = props.strokeWidth ?? 2;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24">`,
    `<g fill="none" stroke="${ICON_STROKE}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    iconMarkup,
    `</g>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveIconNode(props: AudioDeviceIconProps): IconNode {
  if (props.isDisabled || props.isMuted) {
    return props.scope === "input" ? MicOff : VolumeOff;
  }

  if (props.scope === "input") {
    if (props.formFactor === "headphones") {
      return Headphones;
    }

    if (props.formFactor === "line-out" || props.formFactor === "spdif") {
      return AudioLines;
    }

    return Mic;
  }

  if (
    (props.formFactor ?? "unknown") === "unknown" &&
    props.transportType &&
    EXTERNAL_OUTPUT_TRANSPORTS.has(props.transportType)
  ) {
    return Speaker;
  }

  return FORM_FACTOR_ICONS[props.formFactor ?? "unknown"];
}
