import type { DrawRow } from "@/lib/draw/ops";

export type TemplateVars = Record<string, string | number | boolean>;

/** Category ids, in display order. Labels and icons live in categories.ts. */
export const CATEGORY_IDS = [
  "transport",
  "weather",
  "space",
  "finance",
  "news",
  "sports",
  "clocks",
  "science",
  "fun",
  "tech",
  "world",
] as const;

export type TemplateCategory = (typeof CATEGORY_IDS)[number];

export interface Template {
  /** Unique kebab-case id; also the file name in catalog/ and the prefix of row ids. */
  id: string;
  name: string;
  /** One sentence shown on the card. */
  description: string;
  /** Short names of the APIs used, shown as badges and searched. */
  apis: string[];
  category: TemplateCategory;
  /** JS run by src/lib/data/run.ts; its `export const`s become Draw variables. */
  dataCode: string;
  /** Draw rows, built from wire form with rows() in ./rows. */
  rows: DrawRow[];
  /** Real outputs of dataCode, used to render the gallery preview. */
  sampleVars: TemplateVars;
}
