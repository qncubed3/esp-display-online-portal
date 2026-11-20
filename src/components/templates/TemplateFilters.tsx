"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { LayoutGrid, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { CATEGORIES, type Template, type TemplateCategory } from "@/lib/templates/catalog";

export type CategoryFilter = TemplateCategory | "all";

const LABELS = new Map<string, string>(CATEGORIES.map((c) => [c.id, c.label]));

function haystack(t: Template) {
  return [t.name, t.description, ...t.apis, LABELS.get(t.category) ?? ""].join(" ").toLowerCase();
}

// Search (name, description, APIs and category; every word must match) plus a category filter.
// Chip counts reflect the current search, so they show where the matches are.
export function useTemplateFilter(templates: Template[]) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const deferred = useDeferredValue(query);

  const index = useMemo(() => templates.map((t) => ({ t, text: haystack(t) })), [templates]);

  const matched = useMemo(() => {
    const words = deferred.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return templates;
    return index.filter(({ text }) => words.every((w) => text.includes(w))).map(({ t }) => t);
  }, [index, templates, deferred]);

  const counts = useMemo(() => {
    const c = new Map<CategoryFilter, number>([["all", matched.length]]);
    for (const t of matched) c.set(t.category, (c.get(t.category) ?? 0) + 1);
    return c;
  }, [matched]);

  const results = useMemo(
    () => (category === "all" ? matched : matched.filter((t) => t.category === category)),
    [matched, category],
  );
  const searching = deferred.trim().length > 0;

  return { query, setQuery, category, setCategory, results, counts, searching };
}

/** Templates grouped by category, in CATEGORIES order, empty groups left out. */
export function groupByCategory(templates: Template[]) {
  return CATEGORIES.map((c) => ({ category: c, templates: templates.filter((t) => t.category === c.id) })).filter(
    (g) => g.templates.length > 0,
  );
}

type FilterState = ReturnType<typeof useTemplateFilter>;

export function TemplateFilterBar({
  query,
  setQuery,
  category,
  setCategory,
  counts,
  className,
}: Pick<FilterState, "query" | "setQuery" | "category" | "setCategory" | "counts"> & { className?: string }) {
  // Categories with no templates (or no matches) are hidden, unless selected.
  const chips: { id: CategoryFilter; label: string; icon: LucideIcon }[] = [
    { id: "all", label: "All", icon: LayoutGrid },
    ...CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0 || category === c.id),
  ];
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative max-w-md">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              e.stopPropagation(); // clear the search without also closing a surrounding dialog
              setQuery("");
            }
          }}
          placeholder="Search templates, APIs…"
          aria-label="Search templates"
          className={cn(
            "h-8 w-full rounded-md border border-border bg-bg pl-8 pr-8 text-sm text-fg placeholder:text-muted/60",
            "focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/30",
            "[&::-webkit-search-cancel-button]:hidden",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted hover:bg-panel-hover hover:text-fg"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div role="group" aria-label="Category" className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent/50",
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <Icon size={13} />
              {c.label}
              <span className={cn("tabular-nums", active ? "text-accent/80" : "text-muted/70")}>
                {counts.get(c.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
