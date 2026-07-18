import { Airplay, Bluetooth, Cpu, Flame, GitMerge, Layers, Usb, Wifi, Zap } from "lucide";

import type { DeviceTransportType } from "../../audio/types";

type IconNode = Array<[string, Record<string, string | number | undefined>]>;
type IconAttributes = Record<string, string | number | undefined>;

const ICON_STROKE = "#FFFFFF";

const TRANSPORT_ICONS: Record<DeviceTransportType, IconNode> = {
  "built-in": Cpu,
  usb: Usb,
  bluetooth: Bluetooth,
  wireless: Wifi,
  thunderbolt: Zap,
  firewire: Flame,
  pci: Cpu,
  virtual: Layers,
  aggregate: GitMerge,
  airplay: Airplay,
  unknown: Cpu,
};

export function renderTransportDetailIcon(options: {
  transportType?: DeviceTransportType;
  size: number;
  strokeWidth?: number;
}): string {
  const iconNode = TRANSPORT_ICONS[options.transportType ?? "unknown"];
  const iconMarkup = iconNode
    .map(([tag, attrs]) => {
      const attrsMarkup = Object.entries(attrs as IconAttributes)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(" ");
      return `<${tag} ${attrsMarkup}></${tag}>`;
    })
    .join("");

  const strokeWidth = options.strokeWidth ?? 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" viewBox="0 0 24 24">`,
    `<g fill="none" stroke="${ICON_STROKE}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    iconMarkup,
    `</g>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function formatTransportTypeLabel(transportType?: DeviceTransportType): string {
  switch (transportType) {
    case "built-in":
      return "Built-in";
    case "usb":
      return "USB";
    case "bluetooth":
      return "Bluetooth";
    case "wireless":
      return "Wireless";
    case "thunderbolt":
      return "Thunderbolt";
    case "firewire":
      return "FireWire";
    case "pci":
      return "PCI";
    case "virtual":
      return "Virtual";
    case "aggregate":
      return "Aggregate";
    case "airplay":
      return "AirPlay";
    default:
      return "Unknown";
  }
}
