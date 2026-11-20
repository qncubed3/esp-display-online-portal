// The template catalog. Every file in ./templates/ is one template (default export), found by
// scripts/gen-templates.mjs, which writes ./generated.ts (gitignored) before dev and build.
// See ../AUTHORING.md.
import { ALL, FILE_IDS } from "./generated";
import type { Template } from "./types";

export type { Template, TemplateCategory, TemplateVars } from "./types";
export { CATEGORY_IDS } from "./types";
export { CATEGORIES, type CategoryInfo } from "./categories";

const byId = new Map<string, Template>();
ALL.forEach((t, i) => {
  if (t.id !== FILE_IDS[i]) {
    throw new Error(`Template file templates/${FILE_IDS[i]}.ts has id "${t.id}"; the id must match the file name.`);
  }
  if (byId.has(t.id)) throw new Error(`Duplicate template id "${t.id}".`);
  byId.set(t.id, t);
});

export const TEMPLATES: Template[] = ALL;

export function getTemplate(id: string): Template | undefined {
  return byId.get(id);
}
