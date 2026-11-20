// Screens the device endpoint draws itself (not from a Service's Draw rows). Shared with the
// device "Live" preview so both show the same thing.

import type { WireOp } from "./ops";

export function errorFrameOps(message: string): WireOp[] {
  const msg = message.replace(/\s+/g, " ").trim();
  const short = msg.length > 50 ? msg.slice(0, 49) + "…" : msg;
  return [
    ["fillScreen", "#000000"],
    ["setTextDatum", "TL"],
    ["setTextColor", "#FF0000"],
    ["setTextSize", 2],
    ["drawString", "DATA ERROR", 8, 8, 1],
    ["setTextColor", "#FFFFFF"],
    ["setTextSize", 1],
    ["drawString", short, 8, 36, 1],
  ];
}

// Shown by a device that isn't subscribed to a Service. TFT_eSPI's built-in fonts are ASCII only,
// so the arrow is "->" and other characters in the name become "?".
export function noServiceOps(deviceName: string): WireOp[] {
  const name = deviceName.replace(/[^ -~]/g, "?").trim();
  const shortName = name.length > 38 ? name.slice(0, 37) + "~" : name;
  return [
    ["fillScreen", "#000000"],
    ["setTextDatum", "MC"],
    ["setTextColor", "#FFFF00"],
    ["setTextSize", 2],
    ["drawString", "No service assigned", 160, 80, 1],
    ["setTextSize", 1],
    ["setTextColor", "#FFFFFF"],
    ["drawString", "Choose a Service for this device", 160, 122, 2],
    ["drawString", "in the portal -> Devices", 160, 142, 2],
    ["drawString", shortName, 160, 180, 2],
  ];
}
