// The original hand-built templates. New templates go in a batch file, not here.
import type { Template } from "./types";
import { metroDepartures } from "./metro-departures";
import { weather } from "./weather";
import { clock } from "./clock";
import { crypto } from "./crypto";
import { quote } from "./quote";
import { clockVk3ptn } from "./clock-vk3ptn";

export const CORE: Template[] = [metroDepartures, weather, clock, crypto, quote, clockVk3ptn];
