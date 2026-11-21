"use client";

import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Decoration, EditorView, MatchDecorator, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

import { LINE_HEIGHT, MIN_LINES, PAD_Y } from "./editorMetrics";

const c = {
  bg: "#121212",
  fg: "#ededed",
  muted: "#a0a0a0",
  dim: "#5f5f5f",
  border: "#2e2e2e",
  accent: "#3ecf8e",
  keyword: "#c4a7e7", // soft violet
  module: "#ff8fb1", // export / import
  string: "#9ad8b0", // pale green, sits next to the accent
  number: "#f5b97a", // warm orange
  fn: "#7fb4ff", // blue
  prop: "#9fd3e6", // light cyan
  regexp: "#f28b82",
};

const theme = EditorView.theme(
  {
    "&": { backgroundColor: c.bg, color: c.fg, fontSize: "13px" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: `${LINE_HEIGHT}px`,
      overflowY: "hidden",
    },
    ".cm-content": {
      padding: `${PAD_Y}px 0`,
      minHeight: `${MIN_LINES * LINE_HEIGHT + 2 * PAD_Y}px`,
      caretColor: c.accent,
    },
    ".cm-line": { padding: "0 16px 0 12px" },
    ".cm-gutters": { backgroundColor: c.bg, color: c.dim, border: "none", borderRight: `1px solid ${c.border}` },
    ".cm-gutter": { minHeight: `${MIN_LINES * LINE_HEIGHT + 2 * PAD_Y}px` },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px", minWidth: "28px" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: c.muted },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.025)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: c.accent, borderLeftWidth: "2px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "rgba(62,207,142,0.18) !important" },
    ".cm-selectionMatch": { backgroundColor: "rgba(255,255,255,0.07)" },
    "&.cm-focused .cm-matchingBracket": { backgroundColor: "rgba(62,207,142,0.15)", outline: `1px solid rgba(62,207,142,0.45)` },
    "&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "rgba(229,72,77,0.25)" },
    ".cm-placeholder": { color: "rgba(160,160,160,0.5)" },
    ".cm-builtin, .cm-builtin *": { color: `${c.accent} !important`, fontWeight: "500" },
    ".cm-panels": { backgroundColor: "#1c1c1c", color: c.fg },
    ".cm-panels.cm-panels-top": { borderBottom: `1px solid ${c.border}` },
    ".cm-searchMatch": { backgroundColor: "rgba(245,185,122,0.2)" },
    ".cm-tooltip": { backgroundColor: "#1c1c1c", border: `1px solid ${c.border}`, color: c.fg },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword], color: c.keyword },
  { tag: t.moduleKeyword, color: c.module, fontWeight: "500" },
  { tag: t.operatorKeyword, color: c.module }, // await, typeof, in, of, ...
  { tag: [t.string, t.special(t.string)], color: c.string },
  { tag: t.regexp, color: c.regexp },
  { tag: [t.number, t.bool, t.null, t.atom], color: c.number },
  { tag: [t.lineComment, t.blockComment, t.comment], color: c.dim, fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.definition(t.variableName))], color: c.fn },
  { tag: t.function(t.propertyName), color: c.fn },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: c.prop },
  { tag: [t.self, t.special(t.variableName)], color: c.keyword, fontStyle: "italic" },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: c.muted },
  { tag: t.typeName, color: c.number },
  { tag: [t.processingInstruction, t.macroName], color: c.module }, // C++: #include, #define
  { tag: t.heading, color: c.fn, fontWeight: "600" }, // Markdown
  { tag: t.strong, fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: [t.link, t.url], color: c.prop },
  { tag: t.monospace, color: c.string },
  { tag: t.invalid, color: c.regexp },
]);

// The runtime's built-in helpers get(...) and now(...) are marked in the accent green.
const builtinMatcher = new MatchDecorator({
  regexp: /\b(?:get|now)\b(?=\s*\()/g,
  decoration: Decoration.mark({ class: "cm-builtin" }),
});
const builtins = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = builtinMatcher.createDeco(view);
    }
    update(u: ViewUpdate) {
      this.decorations = builtinMatcher.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

const shared = [indentUnit.of("  "), syntaxHighlighting(highlight), theme];
const extensionsFor = {
  javascript: [javascript(), builtins, ...shared],
  json: [json(), ...shared],
  cpp: [cpp(), ...shared],
  markdown: [markdown(), ...shared],
};

export type CodeLanguage = keyof typeof extensionsFor;

export default function CodeEditor({
  value,
  onChange,
  placeholder,
  language = "javascript",
  readOnly = false,
}: {
  value: string;
  onChange?(v: string): void;
  placeholder?: string;
  language?: CodeLanguage;
  /** Highlighted and selectable, not editable (e.g. the firmware files viewer). */
  readOnly?: boolean;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      theme="none"
      extensions={extensionsFor[language]}
      editable={!readOnly}
      readOnly={readOnly}
      indentWithTab={!readOnly}
      basicSetup={{
        tabSize: 2,
        lineNumbers: true,
        bracketMatching: true,
        closeBrackets: true,
        foldGutter: false,
        autocompletion: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        syntaxHighlighting: false, // replaced by our own style above
      }}
    />
  );
}
