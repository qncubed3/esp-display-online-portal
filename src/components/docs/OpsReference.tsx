import { OPS, type Field } from "@/lib/draw/ops";
import { Code, Table } from "./Prose";

// Draw ops reference, generated from OPS so it always matches the editor, preview and firmware.

function argType(f: Field): string {
  switch (f.type) {
    case "int":
      return "int";
    case "color":
      return "colour";
    case "text":
      return "text";
    case "select":
      return (f.options ?? []).map((o) => String(o.value)).join(" | ");
  }
}

function Arg({ f }: { f: Field }) {
  const def = f.optional ? "optional" : `= ${typeof f.default === "string" ? JSON.stringify(f.default) : f.default}`;
  return (
    <span className="whitespace-nowrap">
      <span className="font-mono text-[12px] text-fg">{f.key}</span>
      <span className="font-mono text-[12px] text-muted">: {argType(f)} </span>
      <span className="font-mono text-[12px] text-muted/70">{def}</span>
    </span>
  );
}

export default function OpsReference() {
  const groups = ["Screen", "Shapes", "Text"] as const;
  const rows = groups.flatMap((g) =>
    OPS.filter((d) => d.group === g).map((d) => [
      <Code key="op">{d.op}</Code>,
      <span key="label" className="whitespace-nowrap">
        {d.label}
        <span className="ml-1.5 text-[11px] text-muted/60">{g}</span>
      </span>,
      <ol key="args" className="flex flex-wrap gap-x-3 gap-y-1">
        {d.fields.map((f, i) => (
          <li key={f.key}>
            <span className="mr-1 text-[11px] text-muted/50">{i + 1}.</span>
            <Arg f={f} />
          </li>
        ))}
      </ol>,
    ]),
  );
  return <Table head={["Op", "Row label", "Args, in order (type = default)"]} rows={rows} />;
}
