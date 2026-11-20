import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Big clock + date

const clockCode = String.raw`// A big clock with the date, a greeting and how much of the day has gone.
// Uses only now() (in the service owner's timezone). The screen refreshes on each device poll.
const DAYS = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const h = Number(now("HH"));
const m = Number(now("mm"));

export const time = now("HH:mm");
export const weekday = DAYS[now("ddd")] || now("ddd");
export const date = Number(now("DD")) + " " + MONTHS[Number(now("MM")) - 1] + " " + now("YYYY");

// Colour and greeting follow the time of day.
const part = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 21 ? 2 : 3;
export const greeting = ["Good morning", "Good afternoon", "Good evening", "Good night"][part];
export const accent = ["#FFA500", "#00C8FF", "#FF6080", "#8C8CFF"][part];

// Progress bar: 240 px wide at 100%.
const pct = Math.floor(((h * 60 + m) / 1440) * 100);
export const day_pct = pct + "% OF TODAY DONE";
export const day_w = Math.max(8, Math.round((240 * pct) / 100));
`;

const clockWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 4, "{accent}"],
  ["setTextSize", 1],
  ["setTextDatum", "TC"],
  ["setTextColor", "#A0A0A0"],
  ["drawString", "{greeting}", 160, 18, 2],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 3],
  ["setTextDatum", "MC"],
  ["drawString", "{time}", 160, 96, 4],
  ["setTextSize", 1],
  ["setTextDatum", "TC"],
  ["setTextColor", "{accent}"],
  ["drawString", "{weekday}", 160, 146, 4],
  ["setTextColor", "#D3D3D3"],
  ["drawString", "{date}", 160, 178, 2],
  ["fillRoundRect", 40, 208, 240, 8, 4, "#303030"],
  ["fillRoundRect", 40, 208, "{day_w}", 8, 4, "{accent}"],
  ["setTextColor", "#808080"],
  ["drawString", "{day_pct}", 160, 224, 1],
];

const template: Template = {
  id: "clock",
  name: "Clock + date",
  description: "A large clock, the weekday and date, and a bar showing how much of the day has gone.",
  apis: ["now() only"],
  category: "clocks",
  dataCode: clockCode,
  rows: rows("clock", clockWire),
  sampleVars: {"accent": "#FFA500", "date": "20 November 2026", "day_pct": "33% OF TODAY DONE", "day_w": 81, "greeting": "Good morning", "time": "08:05", "weekday": "Friday"},
};

export default template;
