"use client";

import { LoaderCircle } from "lucide-react";

type Vars = Record<string, string | number | boolean>;

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
        <dl className="max-h-56 overflow-auto px-3 py-2 font-mono text-[12px]">
          {names.map((name) => (
            <div key={name} className="flex items-baseline gap-2 py-0.5">
              <dt className="shrink-0 text-accent">{name}</dt>
              <span className="text-[#5a5a5a]">=</span>
              <dd className="min-w-0 flex-1 truncate text-fg" title={String(vars[name])}>
                {JSON.stringify(vars[name])}
              </dd>
              <span className="shrink-0 text-[11px] text-[#5a5a5a]">{typeof vars[name]}</span>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
