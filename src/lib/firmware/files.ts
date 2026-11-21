// ESP32 firmware for a device: an Arduino sketch folder `EspDisplay/`.
//
// Deterministic: the files come from fixed templates with only the device's
// values filled in (no dates, no randomness), so the same input always gives
// byte-identical output. Only config.h differs between devices.
//
// The op player's `case` lines are generated from OPS (src/lib/draw/ops.ts) so
// the firmware stays in step with the Draw editor. An op without a C++ mapping
// here throws, so a new op can't silently go missing from the firmware. An op's rotation field is
// left out: the server expands it (src/lib/draw/rotate.ts), except for text, which becomes the
// device-only op drawStringRot (frame v2).

import { DATUMS, OPS, deviceFields, type FieldType, type OpDef } from "../draw/ops";
import { TEXT_ROT_OP } from "../draw/rotate";
import { FW_VERSION } from "./version";

export interface FirmwareInput {
  serviceUrl: string;
  deviceKey: string;
  deviceName: string;
  wifiSsid?: string;
  wifiPassword?: string;
}

export interface FirmwareFile {
  path: string;
  content: string;
}

export const SKETCH_DIR = "EspDisplay";
export { FW_VERSION }; // defined in ./version.ts, which client code can import without the templates
export const PLACEHOLDER_SSID = "YOUR_WIFI";
export const PLACEHOLDER_PASSWORD = "YOUR_PASSWORD";
export const PLACEHOLDER_KEY = "PASTE_DEVICE_KEY_HERE";

// ---------------------------------------------------------------------------
// Helpers

// A C string literal. Non-ASCII (UTF-8) bytes and control characters become
// 3-digit octal escapes, which can't run into a following character like \x can.
function cString(s: string): string {
  let out = '"';
  for (const b of new TextEncoder().encode(s)) {
    if (b === 0x22) out += '\\"';
    else if (b === 0x5c) out += "\\\\";
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    else out += "\\" + b.toString(8).padStart(3, "0");
  }
  return out + '"';
}

// Safe inside a // comment: one line, no backslash (a trailing one would continue the comment).
function commentText(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\\/g, "/").trim();
}

// FNV-1a over UTF-8 bytes; must match opHash() in the sketch.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h;
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "device";
}

export function firmwareZipName(deviceName: string): string {
  return `${SKETCH_DIR}-${slugify(deviceName)}.zip`;
}

// ---------------------------------------------------------------------------
// Op player generation

// TFT_eSPI datum constants for the editor's anchor names.
const DATUM_CONSTANTS: Record<string, string> = {
  TL: "TL_DATUM", TC: "TC_DATUM", TR: "TR_DATUM",
  ML: "ML_DATUM", MC: "MC_DATUM", MR: "MR_DATUM",
  BL: "BL_DATUM", BC: "BC_DATUM", BR: "BR_DATUM",
};

// TFT_eSPI font number -> the User_Setup.h define that loads it.
const FONT_LOADS: Record<number, string> = {
  1: "LOAD_GLCD", 2: "LOAD_FONT2", 4: "LOAD_FONT4", 6: "LOAD_FONT6", 7: "LOAD_FONT7", 8: "LOAD_FONT8",
};

// Shape ops whose TFT_eSPI method takes ints then one colour, in field order:
// `tft.<op>(int..., color)`. Listed by name (not inferred) so an op that isn't a
// real TFT_eSPI method fails here, not in the Arduino compiler.
const SHAPE_OPS = new Set([
  "fillScreen", "drawPixel", "drawLine", "drawFastHLine", "drawFastVLine",
  "drawRect", "fillRect", "drawRoundRect", "fillRoundRect",
  "drawCircle", "fillCircle", "drawTriangle", "fillTriangle",
]);

function fail(def: OpDef, why: string): never {
  throw new Error(`firmware: can't generate C++ for op "${def.op}": ${why}. Update src/lib/firmware/files.ts.`);
}

// Check an op's fields still have the shape its C++ case was written for.
// "color?" = optional trailing colour.
function expectFields(def: OpDef, shape: string[]): void {
  const actual = deviceFields(def).map((f) => f.type + (f.optional ? "?" : ""));
  if (actual.join(",") !== shape.join(",")) {
    fail(def, `fields are [${actual.join(", ")}], expected [${shape.join(", ")}]`);
  }
}

function fontOptions(def: OpDef): number[] {
  const field = def.fields[3];
  const fonts = (field?.options ?? []).map((o) => Number(o.value));
  if (fonts.length === 0 || fonts.some((n) => !Number.isInteger(n))) fail(def, "font options must be integers");
  for (const n of fonts) if (!FONT_LOADS[n]) fail(def, `TFT_eSPI has no built-in font ${n}`);
  return fonts;
}

// Each returns the body of `case opHash("<op>"): <body>`; args are a[1], a[2], ...
const CUSTOM: Record<string, (def: OpDef) => string[]> = {
  setTextColor(def) {
    expectFields(def, ["color", "color?"]);
    return [
      "{",
      "  uint16_t fg, bg = 0;",
      "  if (!col(a[1], fg)) break;",
      "  // One colour, an unreadable bg, or bg == fg: transparent background (TFT_eSPI's rule).",
      "  bool hasBg = a.size() > 2 && col(a[2], bg);",
      "  if (hasBg) tft.setTextColor(fg, bg);",
      "  else tft.setTextColor(fg);",
      "  textFg = fg;",
      "  textBg = bg;",
      "  textHasBg = hasBg && bg != fg;",
      "  break;",
      "}",
    ];
  },
  setTextSize(def) {
    expectFields(def, ["select"]);
    return [
      "{",
      "  int32_t s = num(a[1]);",
      "  textSizeNow = s < 1 ? 1 : s > 7 ? 7 : (uint8_t)s;",
      "  tft.setTextSize(textSizeNow);",
      "  break;",
      "}",
    ];
  },
  setTextDatum(def) {
    expectFields(def, ["select"]);
    return [
      "{",
      "  int d = datumIndex(a[1]);",
      "  if (d < 0) break;",
      "  tft.setTextDatum(DATUM_VALUES[d]);",
      "  textDatumNow = d;",
      "  break;",
      "}",
    ];
  },
  drawString(def) {
    expectFields(def, ["text", "int", "int", "select"]);
    const fonts = fontOptions(def);
    const check = fonts.map((n) => `f != ${n}`).join(" && ");
    return [
      "{",
      "  int32_t f = a.size() > 4 ? num(a[4]) : 1;",
      `  if (${check}) f = 1;  // fonts loaded by User_Setup.h`,
      "  tft.drawString(text(a[1]), num(a[2]), num(a[3]), (uint8_t)f);",
      "  break;",
      "}",
    ];
  },
};

// Device-only ops: made by the server, never a Draw row. Same body format as CUSTOM.
const DEVICE_ONLY: Record<string, () => string[]> = {
  [TEXT_ROT_OP]() {
    // drawString's args, then the angle (degrees clockwise).
    const def = OPS.find((d) => d.op === "drawString");
    if (!def) throw new Error("firmware: drawStringRot needs the drawString op");
    const check = fontOptions(def).map((n) => `f != ${n}`).join(" && ");
    return [
      "{",
      "  int32_t f = a.size() > 4 ? num(a[4]) : 1;",
      `  if (${check}) f = 1;  // fonts loaded by User_Setup.h`,
      "  drawStringRotated(text(a[1]), num(a[2]), num(a[3]), (uint8_t)f, a.size() > 5 ? num(a[5]) : 0);",
      "  break;",
      "}",
    ];
  },
};

function shapeCase(def: OpDef): string[] {
  const allowed: FieldType[] = ["int", "color"];
  const fields = deviceFields(def);
  if (fields.some((f) => !allowed.includes(f.type) || f.optional)) {
    fail(def, "shape ops must have only required int and colour fields");
  }
  const colors = fields.filter((f) => f.type === "color").length;
  if (colors !== 1) fail(def, `shape ops must have exactly one colour field (has ${colors})`);
  const ci = fields.findIndex((f) => f.type === "color") + 1;
  const args = fields.map((f, i) => (f.type === "color" ? "c" : `num(a[${i + 1}])`));
  return [`{ uint16_t c; if (col(a[${ci}], c)) tft.${def.op}(${args.join(", ")}); break; }`];
}

function caseLines(): string {
  const seen = new Map<number, string>();
  const out: string[] = [];
  const cases: { def: OpDef; body: () => string[] }[] = [
    ...OPS.filter((def) => !def.expand) // editor-only ops are expanded by the server into other ops
      .map((def) => {
        const custom = Object.prototype.hasOwnProperty.call(CUSTOM, def.op) ? CUSTOM[def.op] : undefined;
        return { def, body: () => (custom ? custom(def) : SHAPE_OPS.has(def.op) ? shapeCase(def) : fail(def, "no mapping")) };
      }),
    ...Object.entries(DEVICE_ONLY).map(([op, body]) => ({ def: { op, label: op, group: "Text", fields: [] } as OpDef, body })),
  ];
  for (const { def, body: make } of cases) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.op)) fail(def, "op name is not a C++ identifier");
    const h = fnv1a(def.op);
    const clash = seen.get(h);
    if (clash) fail(def, `opHash collides with "${clash}"`);
    seen.set(h, def.op);

    const body = make();
    const head = `case opHash("${def.op}"):`;
    if (body.length === 1) {
      out.push(`      ${head.padEnd(32)} ${body[0]}`);
    } else {
      out.push(`      ${head} ${body[0]}`);
      for (const line of body.slice(1)) out.push(`      ${line}`);
    }
  }
  return out.join("\n");
}

function datumTables(): string {
  const names = DATUMS.map((d) => `"${d}"`);
  const values = DATUMS.map((d) => DATUM_CONSTANTS[d] ?? (() => { throw new Error(`firmware: no TFT_eSPI datum for "${d}"`); })());
  return [
    `const uint8_t DATUM_COUNT = ${DATUMS.length};`,
    `const char* const DATUM_NAMES[DATUM_COUNT] = {${names.join(", ")}};`,
    `const uint8_t DATUM_VALUES[DATUM_COUNT] = {${values.join(", ")}};`,
  ].join("\n");
}

function fontLoadLines(): string {
  const def = OPS.find((d) => d.op === "drawString");
  const fonts = def ? fontOptions(def) : [1];
  return fonts.map((n) => `#define ${FONT_LOADS[n]}`).join("\n");
}

// ---------------------------------------------------------------------------
// Files

function configH(input: FirmwareInput): string {
  const ssid = input.wifiSsid ? input.wifiSsid : PLACEHOLDER_SSID;
  const password = input.wifiSsid || input.wifiPassword ? (input.wifiPassword ?? "") : PLACEHOLDER_PASSWORD;
  const key = input.deviceKey.trim() || PLACEHOLDER_KEY;
  const name = commentText(input.deviceName) || "device";
  return `// EspDisplay settings for "${name}".
// This is the only file that differs between devices. Keep it private: it holds
// your WiFi password and the device key.

#pragma once

// Your WiFi network (2.4 GHz; the ESP32 can't join 5 GHz networks).
#define WIFI_SSID     ${cString(ssid)}
#define WIFI_PASSWORD ${cString(password)}

// Where the device fetches its screen, and the key that identifies it.
#define SERVICE_URL   ${cString(input.serviceUrl)}
#define DEVICE_KEY    ${cString(key)}

// Shown on the boot screen.
#define DEVICE_NAME   ${cString(input.deviceName.trim() || "device")}

// Sent to the server as X-FW.
#define FW_VERSION    ${cString(FW_VERSION)}
`;
}

function userSetupH(): string {
  return `// TFT_eSPI setup for the "Cheap Yellow Display" (CYD): ESP32 + ST7789 320x240.
//
// TFT_eSPI reads its settings from its OWN folder, not from this sketch.
// Copy this file over:
//   Arduino/libraries/TFT_eSPI/User_Setup.h
// (Documents/Arduino/libraries/... on Windows and macOS, ~/Arduino/libraries/... on Linux).
// EspDisplay.ino stops the build with an error if TFT_eSPI isn't using it.
// Updating the TFT_eSPI library overwrites the file, so copy it again afterwards.

#define USER_SETUP_LOADED 1
#define USER_SETUP_INFO "EspDisplay CYD ST7789"
#define ESPDISPLAY_USER_SETUP 1   // checked by EspDisplay.ino

#define ST7789_DRIVER 1
#define TFT_RGB_ORDER TFT_BGR     // if red and blue are swapped on your board, try TFT_RGB

#define TFT_WIDTH  240
#define TFT_HEIGHT 320

#define TFT_MISO 12
#define TFT_MOSI 13
#define TFT_SCLK 14
#define TFT_CS   15
#define TFT_DC    2
#define TFT_RST  -1

#define TFT_BL   21
#define TFT_BACKLIGHT_ON HIGH

// Built-in fonts the portal's Text op can use.
${fontLoadLines()}

#define SPI_FREQUENCY  20000000
`;
}

function readme(): string {
  return `# EspDisplay

Firmware for an ESP32 "Cheap Yellow Display" (CYD, ST7789 320x240) that shows a
Service from ESP Display Online Portal. The device asks the portal for its screen
every 30 seconds or so and draws whatever it gets back.

## Setup

1. Install the [Arduino IDE](https://www.arduino.cc/en/software) (2.x).
2. Add ESP32 support: **Tools > Board > Boards Manager**, search "esp32", install
   **esp32 by Espressif Systems**.
3. Install the libraries: **Tools > Manage Libraries**, install
   - **TFT_eSPI** by Bodmer
   - **ArduinoJson** by Benoit Blanchon, version **7.x**
4. Copy \`User_Setup.h\` from this folder over the one in the TFT_eSPI library:
   \`Arduino/libraries/TFT_eSPI/User_Setup.h\` (on Windows: \`Documents\\Arduino\\libraries\\TFT_eSPI\\\`).
   TFT_eSPI only reads its own folder. Copy it again whenever you update TFT_eSPI.
5. Open \`EspDisplay.ino\` (keep all files together in the \`EspDisplay\` folder).
6. Edit \`config.h\`: your WiFi name and password, and the device key if it still
   says \`PASTE_DEVICE_KEY_HERE\`.
7. Select **Tools > Board > esp32 > ESP32 Dev Module** and the board's port, then
   click **Upload**. If the upload doesn't start, hold the BOOT button while it connects.

Open **Tools > Serial Monitor** at 115200 baud to see what the device is doing.

## What the screen shows

- **Connecting to WiFi** while it joins your network, then **WiFi connected**.
- Your Service's screen once the first poll succeeds. It only redraws when the
  screen changes.
- A small **red dot** in the top-right corner: the last update failed (no WiFi or
  server unreachable). The last screen stays up and the device keeps trying.
- **Device key rejected**: the key in \`config.h\` is wrong, or was regenerated or
  deleted in the portal. Put the current key in \`config.h\` and upload again.
- **Service is turned off**: the Service is disabled in the portal. The device
  checks again every few minutes.
- **Setup needed**: \`config.h\` still has a placeholder value.
- A build error saying TFT_eSPI isn't using EspDisplay's User_Setup.h: redo step 4.

## Notes

- HTTPS is used, but the server's certificate is not checked (\`setInsecure()\`),
  to avoid keeping a root certificate up to date on the device.
- Written for the ESP32 Arduino core 3.x (also fine on 2.0.x). If TFT_eSPI fails to
  compile on your core version, install esp32 core 2.0.17 in the Boards Manager.
- Red and blue swapped? Change \`TFT_RGB_ORDER\` in \`User_Setup.h\` to \`TFT_RGB\`.
- Colours look like a photo negative? Flip \`tft.invertDisplay(false)\` in \`setup()\` to \`true\`.
- \`EspDisplay.ino\` and \`User_Setup.h\` are the same for every device; only
  \`config.h\` changes.

## Firmware versions

This is **${FW_VERSION}**. The device reports its version to the portal (Devices >
details), and the portal flags a device whose screen uses something its firmware
can't draw yet.

- **2.0.0**: rotated text, and flipping the screen 180 degrees (set per device on the
  portal's Devices page, for a display mounted upside down). The orientation is
  remembered across restarts.
- Devices still on **1.x** keep working with no changes: they get the same frames as
  before. Rotated shapes draw the same on them; rotated text is drawn unrotated and the
  screen flip setting is ignored until the device is reflashed with these files.
  To update, download the setup files again and upload them (same steps as above;
  your \`config.h\` can be kept).
`;
}

function sketchIno(): string {
  return String.raw`// EspDisplay: shows a Service from ESP Display Online Portal on an ESP32
// "Cheap Yellow Display" (ST7789 320x240). See README.md for setup.
//
// This file is the same for every device. Per-device settings are in config.h.
// The op player below is generated from the portal's Draw ops; don't edit it by hand.
//
// Protocol: GET SERVICE_URL?since=<id> with "Authorization: Bearer <key>" and
// "X-Frame-Version: 2" (this firmware reads frame schemas 1 and 2).
//   200 JSON {v, id, next, poll, rot, ops}  draw ops, poll again in next seconds
//                                v2 adds "rot" (1 or 3, the screen orientation set in the
//                                portal) and the drawStringRot op; v1 frames have neither
//   304                          unchanged
//   204                          Service disabled, poll again in X-Next-Poll seconds
//   401                          device key rejected
// "poll" (and the X-Poll-Interval header on every reply) is this device's poll interval, set
// in the portal. It's kept in pollIntervalS and used whenever a reply doesn't say otherwise.
//
// Libraries: TFT_eSPI, ArduinoJson 7.x. Board: ESP32 Dev Module.

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include <esp_timer.h>
#include <ctype.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

#include "config.h"

#ifndef ESPDISPLAY_USER_SETUP
#error "TFT_eSPI is not using EspDisplay's User_Setup.h. Copy EspDisplay/User_Setup.h over Arduino/libraries/TFT_eSPI/User_Setup.h (see README.md)."
#endif

#if ARDUINOJSON_VERSION_MAJOR < 7
#error "EspDisplay needs ArduinoJson 7.x. Update it in Tools > Manage Libraries."
#endif

#define BACKLIGHT_PIN 21

const uint32_t DEFAULT_POLL_S = 30;
const uint32_t MIN_POLL_S = 5;
const uint32_t MAX_POLL_S = 3600;
const uint32_t KEY_REJECTED_POLL_S = 60;
const uint32_t WIFI_CONNECT_MS = 20000;
const uint32_t WIFI_RETRY_MS = 15000;
const uint16_t HTTP_TIMEOUT_MS = 15000;

TFT_eSPI tft = TFT_eSPI();
Preferences prefs;          // flash storage: remembers the screen orientation across restarts

String lastId;              // id of the frame on screen; sent back as ?since=
String frameJson;           // that frame's JSON, to redraw it without the red dot
bool frameOnScreen = false; // a Service frame (not one of our messages) is showing
bool statusDot = false;     // red "last update failed" dot is drawn over the frame
String shownMessage;        // the message screen showing, so it isn't redrawn every loop
bool setupNeeded = false;   // config.h still has placeholders
bool wifiWasUp = false;
uint32_t nextPollAt = 0;    // millis() of the next poll
uint32_t pollIntervalS = DEFAULT_POLL_S;  // this device's poll interval, from the server
uint32_t lastWifiRetry = 0;
uint8_t screenRotation = 1; // tft.setRotation(): 1 landscape, 3 landscape turned 180 degrees

// The text state set by the frame's ops, kept here too for drawStringRotated().
uint16_t textFg = TFT_WHITE;
uint16_t textBg = TFT_BLACK;
bool textHasBg = false;     // false: transparent background
uint8_t textSizeNow = 1;
int textDatumNow = 0;       // index into DATUM_VALUES (0 = TL)

// ---------------------------------------------------------------------------
// Screens

String clip(const String& s, unsigned int n) {
  return s.length() <= n ? s : s.substring(0, n - 3) + "...";
}

// Full-screen message: coloured title and up to two lines of detail.
void showMessage(uint16_t color, const String& title, const String& line1, const String& line2) {
  String key = title + "\n" + line1 + "\n" + line2;
  if (!frameOnScreen && key == shownMessage) return;
  shownMessage = key;
  frameOnScreen = false;
  statusDot = false;
  lastId = "";
  frameJson = "";

  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(TL_DATUM);
  tft.setTextSize(1);
  tft.setTextColor(color, TFT_BLACK);
  tft.drawString(clip(title, 24), 12, 16, 4);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(clip(line1, 40), 12, 60, 2);
  tft.drawString(clip(line2, 40), 12, 82, 2);
  tft.setTextColor(TFT_DARKGREY, TFT_BLACK);
  tft.drawString(clip(String(DEVICE_NAME) + "  " + FW_VERSION, 48), 12, 218, 1);
}

// Keep the last frame up and mark it stale; or a message if nothing was drawn yet.
void showFailure(const String& title, const String& detail) {
  Serial.printf("[poll] %s: %s\n", title.c_str(), detail.c_str());
  if (frameOnScreen) {
    tft.fillCircle(312, 7, 4, TFT_RED);
    statusDot = true;
  } else {
    showMessage(TFT_RED, title, detail, "Retrying...");
  }
}

// ---------------------------------------------------------------------------
// Op player

// FNV-1a at compile time, so op names work as switch cases. Must match fnv1a()
// in the portal's src/lib/firmware/files.ts.
constexpr uint32_t fnv1a(const char* s, uint32_t h) {
  return *s ? fnv1a(s + 1, (h ^ (uint8_t)*s) * 16777619u) : h;
}
#define opHash(name) fnv1a(name, 2166136261u)

// The same hash as a loop, for op names read at run time (no recursion depth to worry about).
uint32_t opHashOf(const char* s) {
  uint32_t h = 2166136261u;
  while (*s) h = (h ^ (uint8_t)*s++) * 16777619u;
  return h;
}

` + datumTables() + String.raw`

// An int argument. Numbers round like JavaScript's Math.round; numeric strings are parsed.
int32_t num(JsonVariantConst v) {
  double d = 0;
  if (v.is<const char*>()) {
    const char* s = v.as<const char*>();
    char* end = nullptr;
    d = strtod(s, &end);
    while (end && isspace((unsigned char)*end)) end++;
    if (end == s || (end && *end)) d = 0;
  } else {
    d = v.as<double>();
  }
  if (!(d > -2147483648.0 && d < 2147483647.0)) return 0;  // NaN or out of range
  return (int32_t)floor(d + 0.5);
}

// A text argument: strings as-is, numbers as written, null as "".
String text(JsonVariantConst v) {
  if (v.isNull()) return String();
  if (v.is<const char*>()) return String(v.as<const char*>());
  String s;
  serializeJson(v, s);
  return s;
}

// "#RRGGBB" or "#RGB" (or a raw RGB565 number) to RGB565. False if unreadable.
bool col(JsonVariantConst v, uint16_t& out) {
  if (v.is<const char*>()) {
    const char* s = v.as<const char*>();
    while (isspace((unsigned char)*s)) s++;
    if (*s == '#') s++;
    char hex[7];
    size_t n = 0;
    while (n < 6 && isxdigit((unsigned char)s[n])) {
      hex[n] = s[n];
      n++;
    }
    const char* rest = s + n;
    while (isspace((unsigned char)*rest)) rest++;
    if (*rest || (n != 6 && n != 3)) return false;
    hex[n] = 0;
    uint32_t rgb = strtoul(hex, nullptr, 16);
    uint8_t r, g, b;
    if (n == 6) {
      r = rgb >> 16; g = (rgb >> 8) & 0xFF; b = rgb & 0xFF;
    } else {
      r = ((rgb >> 8) & 0xF) * 17; g = ((rgb >> 4) & 0xF) * 17; b = (rgb & 0xF) * 17;
    }
    out = tft.color565(r, g, b);
    return true;
  }
  if (v.is<double>()) {
    double d = v.as<double>();
    if (!(d > -2147483648.0 && d < 2147483648.0)) return false;
    out = (uint16_t)((int64_t)d & 0xFFFF);
    return true;
  }
  return false;
}

// "TL".."BR" (any case) or 0..8 to an index into DATUM_VALUES; -1 if unknown.
int datumIndex(JsonVariantConst v) {
  if (v.is<const char*>()) {
    const char* s = v.as<const char*>();
    for (int i = 0; i < DATUM_COUNT; i++) {
      if (strcasecmp(s, DATUM_NAMES[i]) == 0) return i;
    }
    return -1;
  }
  if (v.is<int>()) {
    int i = v.as<int>();
    return i >= 0 && i < DATUM_COUNT ? i : -1;
  }
  return -1;
}

// Turns the panel to rot (1 or 3; anything else is 1) and remembers it, so messages shown
// after a restart are the right way up too. The caller redraws the whole screen.
void applyRotation(int rot) {
  uint8_t r = rot == 3 ? 3 : 1;
  if (r == screenRotation) return;
  screenRotation = r;
  tft.setRotation(r);
  prefs.putUChar("rot", r);
  Serial.printf("[screen] rotation %u\n", (unsigned)r);
}

// drawString at an angle (degrees clockwise) about the centre of the text's unrotated box, with
// the current text colour, size and datum. The text is drawn into a 1-bit sprite (w * h / 8 bytes,
// created and freed here) that is pushed rotated; if there isn't memory for it, the text is drawn
// unrotated instead.
void drawStringRotated(const String& s, int32_t x, int32_t y, uint8_t font, int32_t angle) {
  angle %= 360;
  if (angle < 0) angle += 360;
  int16_t w = tft.textWidth(s, font);
  int16_t h = tft.fontHeight(font);
  if (angle == 0 || s.length() == 0 || w <= 0 || h <= 0) {
    tft.drawString(s, x, y, font);
    return;
  }
  // Datum -> the box's top-left: DATUM_NAMES runs TL TC TR ML MC MR BL BC BR.
  int c = textDatumNow % 3, r = textDatumNow / 3;
  int32_t left = x - (c == 1 ? w / 2 : c == 2 ? w : 0);
  int32_t top = y - (r == 1 ? h / 2 : r == 2 ? h : 0);

  TFT_eSprite spr = TFT_eSprite(&tft);
  spr.setColorDepth(1);
  if (spr.createSprite(w, h) == nullptr) {
    Serial.printf("[draw] no memory for rotated text (%dx%d), drawing it unrotated\n", w, h);
    tft.drawString(s, x, y, font);
    return;
  }
  spr.fillSprite(TFT_BLACK);   // bit 0: background
  spr.setTextColor(TFT_WHITE); // bit 1: ink
  spr.setTextSize(textSizeNow);
  spr.setTextDatum(TL_DATUM);
  spr.drawString(s, 0, 0, font);
  // A transparent background is pushed as a key colour that can't be the ink colour.
  uint16_t bg = textHasBg ? textBg : (uint16_t)(textFg ^ 0xFFFF);
  spr.setBitmapColor(textFg, bg);
  spr.setPivot(w / 2, h / 2);
  tft.setPivot((int16_t)(left + w / 2), (int16_t)(top + h / 2));
  if (textHasBg) spr.pushRotated((int16_t)angle);
  else spr.pushRotated((int16_t)angle, bg);
  spr.deleteSprite();
}

// Draw one frame. Starts from the same state as the portal's preview: black
// screen, white text with a transparent background, size 1, font 1, datum TL.
void playFrame(JsonArrayConst ops) {
  uint16_t first = 0;
  bool startsWithFill = strcmp(ops[0][0] | "", "fillScreen") == 0 && col(ops[0][1], first);
  if (!startsWithFill) tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(1);
  tft.setTextFont(1);
  tft.setTextDatum(TL_DATUM);
  textFg = TFT_WHITE;
  textBg = TFT_BLACK;
  textHasBg = false;
  textSizeNow = 1;
  textDatumNow = 0;

  for (JsonVariantConst item : ops) {
    JsonArrayConst a = item.as<JsonArrayConst>();
    const char* name = a[0] | "";
    switch (opHashOf(name)) {
` + caseLines() + String.raw`
      default: break;  // unknown op: skip it, so a newer server doesn't break an older device
    }
  }

  frameOnScreen = true;
  statusDot = false;
  shownMessage = "";
}

// Parse and draw a frame body. Returns false (and draws nothing) if it isn't a v1 or v2 frame.
// next and poll are the frame's "next" and "poll" fields (0 if missing).
bool playJson(const String& body, String& error, long& next, long& poll) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    error = String("Bad JSON: ") + err.c_str();
    return false;
  }
  int version = doc["v"] | 0;
  if (version != 1 && version != 2) {
    error = "Unsupported frame version";
    return false;
  }
  // v2 frames say which way up the screen goes; v1 frames are always normal landscape.
  applyRotation(version >= 2 ? (int)(doc["rot"] | 1) : 1);
  playFrame(doc["ops"].as<JsonArrayConst>());
  lastId = doc["id"] | "";
  frameJson = body;
  next = doc["next"] | 0L;
  poll = doc["poll"] | 0L;
  return true;
}

// ---------------------------------------------------------------------------
// Polling

uint32_t clampPoll(long s) {
  if (s <= 0) return pollIntervalS;
  if (s < (long)MIN_POLL_S) return MIN_POLL_S;
  if (s > (long)MAX_POLL_S) return MAX_POLL_S;
  return (uint32_t)s;
}

// Store this device's poll interval when the server sends one.
void setPollInterval(long s) {
  if (s <= 0) return;
  uint32_t v = s < (long)MIN_POLL_S ? MIN_POLL_S : s > (long)MAX_POLL_S ? MAX_POLL_S : (uint32_t)s;
  if (v != pollIntervalS) Serial.printf("[poll] interval now %lu s\n", (unsigned long)v);
  pollIntervalS = v;
}

// One request to the server. Returns seconds until the next poll.
uint32_t poll() {
  WiFiClientSecure client;
  client.setInsecure();  // encrypted, but the server certificate isn't checked (see README)

  HTTPClient http;
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);

  String url = SERVICE_URL;
  if (frameOnScreen && lastId.length() > 0) url += "?since=" + lastId;

  if (!http.begin(client, url)) {
    showFailure("Bad server URL", clip(String(SERVICE_URL), 40));
    return pollIntervalS;
  }
  http.addHeader("Authorization", String("Bearer ") + DEVICE_KEY);
  http.addHeader("X-RSSI", String((int)WiFi.RSSI()));
  http.addHeader("X-Heap", String(ESP.getFreeHeap()));
  http.addHeader("X-Uptime", String((uint32_t)(esp_timer_get_time() / 1000000LL)));
  http.addHeader("X-FW", FW_VERSION);
  http.addHeader("X-Frame-Version", "2");  // newest frame schema this firmware reads
  const char* headerKeys[] = {"X-Next-Poll", "X-Poll-Interval"};
  http.collectHeaders(headerKeys, 2);

  int code = http.GET();
  long headerNext = http.header("X-Next-Poll").toInt();  // 0 if missing
  setPollInterval(http.header("X-Poll-Interval").toInt());
  String body;
  if (code == HTTP_CODE_OK) body = http.getString();
  http.end();

  Serial.printf("[poll] GET %s -> %d\n", url.c_str(), code);

  if (code == HTTP_CODE_OK) {
    String error;
    long next = 0, interval = 0;
    if (!playJson(body, error, next, interval)) {
      showFailure("Bad response", error);
      return clampPoll(headerNext);
    }
    setPollInterval(interval);
    Serial.printf("[poll] drew frame %s (%u bytes)\n", lastId.c_str(), body.length());
    return clampPoll(next > 0 ? next : headerNext);
  }

  if (code == HTTP_CODE_NOT_MODIFIED || code == HTTP_CODE_NO_CONTENT) {
    if (statusDot) {
      // Back online: redraw the frame to remove the red dot.
      // Its stored "poll" may be stale, so it's ignored here; the header above is current.
      String error;
      long next = 0, staleInterval = 0;
      String saved = frameJson;
      if (!playJson(saved, error, next, staleInterval)) frameOnScreen = false;
    }
    if (code == HTTP_CODE_NO_CONTENT && !frameOnScreen) {
      showMessage(TFT_YELLOW, "Service is turned off", "Turn it on in the portal.", "Checking again later.");
    }
    return clampPoll(headerNext);
  }

  if (code == HTTP_CODE_UNAUTHORIZED) {
    Serial.println("[poll] device key rejected");
    showMessage(TFT_RED, "Device key rejected", "Check DEVICE_KEY in config.h,", "or regenerate it in the portal.");
    return KEY_REJECTED_POLL_S;
  }

  if (code < 0) {
    showFailure("Can't reach server", HTTPClient::errorToString(code));
  } else {
    showFailure("Server error", String("HTTP ") + code);
  }
  return clampPoll(headerNext);
}

// ---------------------------------------------------------------------------
// WiFi

void connectWifi() {
  showMessage(TFT_CYAN, "Connecting to WiFi...", clip(String(WIFI_SSID), 40), "");
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t start = millis();
  int dots = 0;
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_MS) {
    delay(500);
    Serial.print(".");
    tft.fillRect(12 + (dots % 30) * 8, 110, 4, 4, TFT_CYAN);
    if (++dots % 30 == 0) tft.fillRect(12, 110, 240, 4, TFT_BLACK);
  }
  Serial.println();
  lastWifiRetry = millis();

  if (WiFi.status() == WL_CONNECTED) {
    wifiWasUp = true;
    Serial.printf("[wifi] connected, IP %s, RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    showMessage(TFT_GREEN, "WiFi connected", "IP " + WiFi.localIP().toString(), "Fetching screen...");
  } else {
    Serial.println("[wifi] not connected yet; will keep trying");
    showMessage(TFT_RED, "WiFi not connected", clip(String(WIFI_SSID), 40), "Check config.h. Retrying...");
  }
}

// Called while WiFi is down: mark the screen and retry now and then.
void handleWifiDown() {
  if (wifiWasUp) {
    wifiWasUp = false;
    Serial.println("[wifi] connection lost");
    if (frameOnScreen) {
      tft.fillCircle(312, 7, 4, TFT_RED);
      statusDot = true;
    } else {
      showMessage(TFT_RED, "WiFi not connected", clip(String(WIFI_SSID), 40), "Retrying...");
    }
  }
  if (millis() - lastWifiRetry >= WIFI_RETRY_MS) {
    lastWifiRetry = millis();
    Serial.println("[wifi] reconnecting");
    WiFi.reconnect();
  }
}

// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.printf("\n%s for %s\n", FW_VERSION, DEVICE_NAME);

  pinMode(BACKLIGHT_PIN, OUTPUT);
  digitalWrite(BACKLIGHT_PIN, HIGH);
  tft.init();
  prefs.begin("espdisplay", false);
  screenRotation = prefs.getUChar("rot", 1) == 3 ? 3 : 1;  // last orientation the portal sent
  tft.setRotation(screenRotation);
  // The ST7789 init turns colour inversion on; this panel needs it off. If colours look like a
  // photo negative on your board, change false to true.
  tft.invertDisplay(false);
  tft.fillScreen(TFT_BLACK);

  if (strcmp(WIFI_SSID, "YOUR_WIFI") == 0) {
    setupNeeded = true;
    showMessage(TFT_YELLOW, "Setup needed", "Set WIFI_SSID and WIFI_PASSWORD", "in config.h, then upload again.");
  } else if (strcmp(DEVICE_KEY, "PASTE_DEVICE_KEY_HERE") == 0) {
    setupNeeded = true;
    showMessage(TFT_YELLOW, "Setup needed", "Paste the device key into", "DEVICE_KEY in config.h.");
  }
  if (setupNeeded) {
    Serial.println("[setup] config.h still has placeholders; edit it and upload again");
    return;
  }

  connectWifi();
}

void loop() {
  if (setupNeeded) {
    delay(1000);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    handleWifiDown();
    delay(200);
    return;
  }
  if (!wifiWasUp) {
    wifiWasUp = true;
    Serial.printf("[wifi] connected, IP %s\n", WiFi.localIP().toString().c_str());
    nextPollAt = millis();  // poll straight away
  }

  if ((int32_t)(millis() - nextPollAt) >= 0) {
    uint32_t wait = poll();
    Serial.printf("[poll] next in %lu s\n", (unsigned long)wait);
    nextPollAt = millis() + wait * 1000UL;
  }
  delay(50);
}
`;
}

export function buildFirmwareFiles(input: FirmwareInput): FirmwareFile[] {
  return [
    { path: `${SKETCH_DIR}/${SKETCH_DIR}.ino`, content: sketchIno() },
    { path: `${SKETCH_DIR}/config.h`, content: configH(input) },
    { path: `${SKETCH_DIR}/User_Setup.h`, content: userSetupH() },
    { path: `${SKETCH_DIR}/README.md`, content: readme() },
  ];
}
