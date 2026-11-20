"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button, cn } from "@/components/ui";
import SettingsCard, { Message } from "@/components/settings/SettingsCard";
import { saveTimezone, type SettingsResult } from "@/lib/settings/actions";

function formatNow(now: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(now);
  } catch {
    return "";
  }
}

const label = (tz: string) => tz.replace(/_/g, " ");

export default function TimezoneForm({ zones, saved }: { zones: string[]; saved: string }) {
  const [value, setValue] = useState(saved);
  const [savedValue, setSavedValue] = useState(saved);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [result, setResult] = useState<SettingsResult>({});
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Client clock only, so server and client render the same markup.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "_");
    return q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
  }, [zones, query]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    setQuery("");
    setActive(Math.max(0, zones.indexOf(value)));
    setOpen(true);
  }

  function pick(tz: string) {
    setValue(tz);
    setResult({});
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function save() {
    setResult({});
    startTransition(async () => {
      const res = await saveTimezone(value);
      setResult(res);
      if (res.ok) setSavedValue(value);
    });
  }

  const dirty = value !== savedValue;

  return (
    <SettingsCard
      title="Time zone"
      description={
        <>
          Used by <code className="font-mono text-[12px] text-fg">now()</code> in your Services&apos; Data code.
        </>
      }
      footer={
        <>
          <Message error={result.error} success={result.ok && !dirty ? "Time zone saved." : undefined} />
          {dirty && (
            <Button size="sm" onClick={() => pick(savedValue)} disabled={pending}>
              Cancel
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty || pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div ref={rootRef} className="relative max-w-md">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openList())}
          className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md border border-border bg-bg px-2.5 text-left text-sm hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <span className="truncate">{label(value)}</span>
          <ChevronsUpDown size={14} className="shrink-0 text-muted" />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border-strong bg-panel shadow-lg">
            <div className="flex items-center gap-2 border-b border-border px-2.5">
              <Search size={13} className="shrink-0 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search time zones..."
                aria-label="Search time zones"
                className="h-8 w-full bg-transparent text-sm text-fg placeholder:text-muted/60 focus:outline-none"
              />
            </div>
            <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && <li className="px-2.5 py-1.5 text-[13px] text-muted">No matching time zone.</li>}
              {filtered.map((tz, i) => (
                <li
                  key={tz}
                  data-index={i}
                  role="option"
                  aria-selected={tz === value}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(tz)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-[13px]",
                    i === active ? "bg-panel-hover text-fg" : "text-muted",
                  )}
                >
                  <span className="truncate">{label(tz)}</span>
                  {tz === value && <Check size={13} className="shrink-0 text-accent" />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Current time there:{" "}
        <span className="font-mono text-[12px] tabular-nums text-fg">{now ? formatNow(now, value) : " "}</span>
      </p>
    </SettingsCard>
  );
}
