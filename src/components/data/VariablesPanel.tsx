"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, LoaderCircle } from "lucide-react";

type Vars = Record<string, string | number | boolean>;
type Value = Vars[string];

// How many variables to show before collapsing the rest behind "Show N more".
const COLLAPSED_COUNT = 8;

// Renders a variable value coloured by type: strings quoted, empty strings flagged.
function ValueCell({ value }: { value: Value }) {
  if (typeof value === "string") {
    if (value === "") {
      return (
        <span className="text-muted">
          &quot;&quot; <span className="font-sans text-[11px] italic text-[#6a6a6a]">empty</span>
        </span>
      );
    }
    return <span className="text-amber-200/90">&quot;{value}&quot;</span>;
  }
  if (typeof value === "number") return <span className="text-sky-300">{String(value)}</span>;
  return <span className="text-violet-300">{String(value)}</span>;
}

// Lists the variables exported by the last Data run (`name = value`), plus run state and errors.
export default function VariablesPanel({
  vars,
  error,
  running,
}: {
  vars: Vars;
  error?: string;
  running: boolean;
}) {
  const names = Object.keys(vars).sort();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidden = names.length - COLLAPSED_COUNT;
  const shown = expanded || hidden <= 0 ? names : names.slice(0, COLLAPSED_COUNT);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // Copies the `{name}` placeholder used in the Draw section.
  const copyPlaceholder = async (name: string) => {
    try {
      await navigator.clipboard.writeText(`{${name}}`);
    } catch {
      return;
    }
    setCopied(name);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="mt-4 rounded-md border border-border bg-bg text-[13px]">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-medium text-fg">Variables</span>
        {running ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <LoaderCircle size={12} className="animate-spin" aria-hidden /> Running…
          </span>
        ) : (
          <span className="text-[12px] text-muted">{names.length}</span>
        )}
      </div>
      {error && (
        <div className="border-b border-border bg-red-950/20 px-3 py-2 text-[12px] text-red-300">
          Data section failed: {error}. Variables are shown as empty in the preview.
        </div>
      )}
      {names.length === 0 ? (
        <div className="px-3 py-3 text-muted">{running ? "Running the Data section…" : "Run to see exported variables"}</div>
      ) : (
        <>
          <div className="p-2">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed border-collapse text-[12px]">
                <colgroup>
                  <col className="w-[34%]" />
                  <col />
                  <col className="w-[84px]" />
                  <col className="w-[36px]" />
                </colgroup>
                <thead className="bg-panel">
                  <tr className="text-left text-[10.5px] font-medium uppercase tracking-wider text-muted">
                    <th scope="col" className="px-3 py-1.5 font-medium">Name</th>
                    <th scope="col" className="px-3 py-1.5 font-medium">Value</th>
                    <th scope="col" className="px-3 py-1.5 font-medium">Type</th>
                    <th scope="col" className="py-1.5"><span className="sr-only">Copy placeholder</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((name) => {
                    const value = vars[name];
                    const isCopied = copied === name;
                    return (
                      <tr key={name} className="group border-t border-border transition-colors hover:bg-panel-hover">
                        <td className="truncate px-3 py-1.5 font-mono text-fg" title={name}>
                          {name}
                        </td>
                        <td
                          className="truncate px-3 py-1.5 font-mono"
                          title={typeof value === "string" ? `"${value}"` : String(value)}
                        >
                          <ValueCell value={value} />
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="inline-block rounded-full border border-border bg-panel px-1.5 py-px text-[10.5px] leading-4 text-muted">
                            {typeof value}
                          </span>
                        </td>
                        <td className="py-1.5 pr-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => copyPlaceholder(name)}
                            title={isCopied ? "Copied" : `Copy {${name}}`}
                            aria-label={isCopied ? "Copied" : `Copy {${name}} placeholder`}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded transition-[opacity,colors] hover:bg-border hover:text-fg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-border-strong group-hover:opacity-100 ${
                              isCopied ? "text-accent opacity-100" : "text-muted opacity-0"
                            }`}
                          >
                            {isCopied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full border-t border-border px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-panel-hover hover:text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-border-strong"
            >
              {expanded ? "Show less" : `Show ${hidden} more`}
            </button>
          )}
        </>
      )}
      <span className="sr-only" aria-live="polite">{copied ? `Copied {${copied}}` : ""}</span>
    </div>
  );
}
