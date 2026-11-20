import { CORE } from "./core";
import { BATCH_01 } from "./batch-01";
import { BATCH_02 } from "./batch-02";
import { BATCH_03 } from "./batch-03";
import { BATCH_04 } from "./batch-04";
import { BATCH_05 } from "./batch-05";
import { BATCH_06 } from "./batch-06";
import { BATCH_07 } from "./batch-07";
import { BATCH_08 } from "./batch-08";
import { BATCH_09 } from "./batch-09";
import { BATCH_10 } from "./batch-10";
import type { Template } from "./types";

export type { Template, TemplateCategory, TemplateVars } from "./types";
export { CATEGORY_IDS } from "./types";
export { CATEGORIES, type CategoryInfo } from "./categories";

export const TEMPLATES: Template[] = [
  ...CORE,
  ...BATCH_01,
  ...BATCH_02,
  ...BATCH_03,
  ...BATCH_04,
  ...BATCH_05,
  ...BATCH_06,
  ...BATCH_07,
  ...BATCH_08,
  ...BATCH_09,
  ...BATCH_10,
];

const byId = new Map<string, Template>();
for (const t of TEMPLATES) {
  if (byId.has(t.id) && process.env.NODE_ENV !== "production") {
    throw new Error(`Duplicate template id "${t.id}" in src/lib/templates/catalog/`);
  }
  if (!byId.has(t.id)) byId.set(t.id, t);
}

export function getTemplate(id: string): Template | undefined {
  return byId.get(id);
}
