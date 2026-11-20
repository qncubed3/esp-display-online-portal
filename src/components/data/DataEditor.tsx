"use client";

import dynamic from "next/dynamic";
import { LINE_HEIGHT, MIN_LINES, PAD_Y } from "./editorMetrics";

const PLACEHOLDER = `// Runs before each frame. Exported values can be used in Draw rows as {name}.
// const res = await get("https://api.example.com/weather");
// export const temp = res.temp;
`;

// CodeMirror touches the DOM, so it is loaded on the client only. Until it arrives the
// wrapper's min-height (same metrics as the editor) holds the space so the page doesn't jump.
const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false, loading: () => null });

// Controlled JavaScript editor for the Data section. Starts about 6 lines tall and grows with its content.
export default function DataEditor({ value, onChange }: { value: string; onChange(v: string): void }) {
  const lines = Math.max(MIN_LINES, value.split("\n").length);
  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-[#121212] focus-within:border-border-strong focus-within:ring-2 focus-within:ring-accent/30"
      style={{ minHeight: lines * LINE_HEIGHT + 2 * PAD_Y + 2 }}
    >
      <CodeEditor value={value} onChange={onChange} placeholder={PLACEHOLDER} />
    </div>
  );
}
