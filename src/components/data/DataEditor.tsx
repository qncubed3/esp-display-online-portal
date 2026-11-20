"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

const PLACEHOLDER = `// Runs before each frame. Exported values can be used in Draw rows as {name}.
// const res = await get("https://api.example.com/weather");
// export const temp = res.temp;
`;

// Controlled monospace editor for the Data section. Starts about 6 lines tall and grows with its content.
export default function DataEditor({ value, onChange }: { value: string; onChange(v: string): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`; // +2 for the top/bottom border
  }, [value]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Insert two spaces instead of moving focus.
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      onChange(value.slice(0, start) + "  " + value.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
    }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={PLACEHOLDER}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      rows={6}
      className="block w-full resize-none overflow-hidden rounded-md border border-border bg-[#121212] px-4 py-3 font-mono text-[13px] leading-relaxed text-fg placeholder:text-muted/50 focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
    />
  );
}
