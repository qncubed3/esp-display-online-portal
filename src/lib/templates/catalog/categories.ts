import {
  Clock,
  CloudSun,
  CodeXml,
  FlaskConical,
  Globe,
  Newspaper,
  PartyPopper,
  Rocket,
  TrainFront,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { TemplateCategory } from "./types";

export interface CategoryInfo {
  id: TemplateCategory;
  label: string;
  /** What belongs here; a guide for picking a template's category. */
  hint: string;
  icon: LucideIcon;
}

// Display order on the Templates page and in the Load template dialog.
export const CATEGORIES: CategoryInfo[] = [
  { id: "transport", label: "Transport", hint: "Trains, buses, trams, flights, traffic", icon: TrainFront },
  { id: "weather", label: "Weather", hint: "Weather, air quality, UV, tides", icon: CloudSun },
  { id: "space", label: "Space", hint: "ISS, launches, astronomy, sun and moon", icon: Rocket },
  { id: "finance", label: "Finance", hint: "Crypto, currencies, markets", icon: TrendingUp },
  { id: "news", label: "News", hint: "Headlines and RSS feeds", icon: Newspaper },
  { id: "sports", label: "Sports", hint: "Scores, fixtures, ladders", icon: Trophy },
  { id: "clocks", label: "Clocks", hint: "Clocks, calendars, countdowns", icon: Clock },
  { id: "science", label: "Science", hint: "Earthquakes, nature, environment", icon: FlaskConical },
  { id: "fun", label: "Fun", hint: "Quotes, facts, jokes, games", icon: PartyPopper },
  { id: "tech", label: "Tech", hint: "GitHub, dev and internet stats", icon: CodeXml },
  { id: "world", label: "World", hint: "Countries, holidays, population", icon: Globe },
];
