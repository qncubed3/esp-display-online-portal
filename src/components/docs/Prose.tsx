import type { ReactNode } from "react";

// Small typographic building blocks for the Docs page. Server components, no state.

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-b border-border pb-10 pt-2 last:border-b-0">
      <h2 className="mb-4 text-lg font-medium">
        <a href={`#${id}`} className="hover:text-accent">
          {title}
        </a>
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-6 pt-2 text-[14px] font-medium text-fg">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-6 text-muted">{children}</p>;
}

export function List({ children, ordered }: { children: ReactNode; ordered?: boolean }) {
  const cls = "space-y-1.5 pl-5 text-[13px] leading-6 text-muted marker:text-muted/60";
  return ordered ? <ol className={`list-decimal ${cls}`}>{children}</ol> : <ul className={`list-disc ${cls}`}>{children}</ul>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-border bg-[#121212] px-1 py-px font-mono text-[12px] text-fg">{children}</code>
  );
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-fg">{children}</strong>;
}

export function Pre({ title, children }: { title?: string; children: string }) {
  return (
    <figure className="overflow-hidden rounded-md border border-border bg-[#121212]">
      {title && (
        <figcaption className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted">{title}</figcaption>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 text-fg">{children.replace(/^\n|\n\s*$/g, "")}</pre>
    </figure>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-accent/30 bg-accent/[0.06] px-3 py-2 text-[13px] leading-6 text-muted">
      {children}
    </div>
  );
}

export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="bg-panel text-[12px] text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border-b border-border px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border align-top last:border-b-0">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 leading-5 text-muted">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
