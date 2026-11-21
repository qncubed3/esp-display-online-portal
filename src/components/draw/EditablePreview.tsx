"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Minimize2 } from "lucide-react";
import { SCREEN_HEIGHT, SCREEN_WIDTH, type DrawRow, type WireOp } from "@/lib/draw/ops";
import { applyDrag, canDrag, cursorFor, edgeHandleAt, handlesFor, isRotated } from "@/lib/draw/geometry";
import { opBounds } from "@/lib/draw/preview";
import DevicePreview from "./DevicePreview";

// All in CSS pixels on the preview, so they feel the same at any zoom.
const GRIP_CSS = 10; // grip square size
const GRIP_HIT_CSS = 7; // how far from a grip's centre still grabs it
const EDGE_CSS = 4; // band around the selected box's edges that resizes
const LINE_PAD_CSS = 3; // extra reach for thin lines and pixels

const THIN_OPS = new Set(["drawLine", "drawFastHLine", "drawFastVLine", "drawPixel"]);

type Box = { x: number; y: number; w: number; h: number };

/** Preview scale in the Draw tab (outside full screen). */
export const INLINE_SCALE = 1.75;
/** Size of the inline preview's device frame: screen + p-3 padding + 1px borders. */
export const INLINE_FRAME_WIDTH = SCREEN_WIDTH * INLINE_SCALE + 26;
export const INLINE_FRAME_HEIGHT = SCREEN_HEIGHT * INLINE_SCALE + 26;

/** What the preview's hint line says for the selected row. */
export function previewHint(selRow: DrawRow | null): string {
  if (!selRow) return "Click a shape to select its row";
  if (canDrag(selRow)) {
    return isRotated(selRow) ? "Drag to move · arrows nudge · no resize grips while rotated" : "Drag to move · grips resize · arrows nudge (Shift ×10)";
  }
  return selRow.op === "fillScreen" ? "Fill screen covers the whole screen" : "Uses {variables} for its position, so it can't be dragged";
}

const isFullScreen = (b: Box) => b.x <= 0 && b.y <= 0 && b.x + b.w >= SCREEN_WIDTH && b.y + b.h >= SCREEN_HEIGHT;
const contains = (b: Box, x: number, y: number, pad = 0) =>
  x >= b.x - pad && x < b.x + b.w + pad && y >= b.y - pad && y < b.y + b.h + pad;

// What a press at a point would do: start a resize/reshape from a handle, move (and select) the
// shape drawn by op `index`, or nothing.
type Target = { kind: "handle"; id: string } | { kind: "op"; index: number } | null;

interface Drag {
  pointerId: number;
  handle: string; // "move" or a handle id from handlesFor / edgeHandleAt
  start: DrawRow;
  startX: number;
  startY: number;
  unit: number; // screen pixels per CSS pixel
  lastDx: number;
  lastDy: number;
}

// Pointer position on the canvas in continuous screen coordinates, plus screen pixels per CSS pixel.
function pointOn(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  const unit = r.width > 0 ? SCREEN_WIDTH / r.width : 1;
  return { x: (e.clientX - r.left) * unit, y: (e.clientY - r.top) * (r.height > 0 ? SCREEN_HEIGHT / r.height : 1), unit };
}

// The Draw preview with MS Paint-style editing: click a shape to select its row, drag it to move,
// drag the grips (or the selected box's edges) to resize or reshape. Arrow keys nudge the
// selection (Shift: 10px). A full-screen mode shows the same editor as large as the window allows.
export default function EditablePreview({
  rows,
  ops,
  rowIds,
  selectedId,
  onSelect,
  onRowChange,
  full,
  onFullChange: setFull,
}: {
  rows: DrawRow[];
  ops: WireOp[];
  /** The row each op came from (toWireOpsWithRows). */
  rowIds: string[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  onRowChange(row: DrawRow): void;
  /** Full-screen editing; controlled so the parent's toolbar can open it. */
  full: boolean;
  onFullChange(full: boolean): void;
}) {
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const bounds = useMemo(() => opBounds(ops), [ops]);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [hoverCursor, setHoverCursor] = useState("crosshair");
  const [fullScale, setFullScale] = useState(2);
  const [cssWidth, setCssWidth] = useState(0); // canvas width in CSS px, for placing grips

  // A row can make several ops (e.g. "text", or a rotated rectangle's triangles); its box covers them all.
  const selRow = selectedId ? rowById.get(selectedId) ?? null : null;
  const selBox = useMemo(() => {
    if (!selRow) return null;
    let out: Box | null = null;
    bounds.forEach((b, i) => {
      if (!b || rowIds[i] !== selRow.id) return;
      if (!out) out = { ...b };
      else {
        const r = Math.max(out.x + out.w, b.x + b.w), btm = Math.max(out.y + out.h, b.y + b.h);
        out = { x: Math.min(out.x, b.x), y: Math.min(out.y, b.y), w: 0, h: 0 };
        out.w = r - out.x;
        out.h = btm - out.y;
      }
    });
    return out as Box | null;
  }, [selRow, bounds, rowIds]);
  const movable = selRow ? canDrag(selRow) : false;
  const handles = selRow && movable ? handlesFor(selRow) : [];

  const canvas = () => rootRef.current?.querySelector("canvas") ?? null;

  // Track the canvas's CSS size (it changes with full screen, window size and layout).
  const observe = useCallback((root: HTMLDivElement | null) => {
    rootRef.current = root;
    const c = root?.querySelector("canvas");
    if (!c) return;
    const ro = new ResizeObserver(() => setCssWidth(c.getBoundingClientRect().width));
    ro.observe(c);
    setCssWidth(c.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Full screen: fit the 4:3 screen to the window, close on Esc, lock page scroll.
  useEffect(() => {
    if (!full) return;
    const fit = () => {
      // Room left after the backdrop padding, top bar, device frame, readout and hint.
      const w = window.innerWidth - 48 - 26;
      const h = window.innerHeight - 48 - 56 - 26 - 60;
      const s = Math.max(1, Math.min(w / SCREEN_WIDTH, h / SCREEN_HEIGHT));
      setFullScale(s >= 2 ? Math.floor(s * 4) / 4 : s);
    };
    fit();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => canvas()?.focus());
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [full]);

  // Hit-testing, in order:
  //  (a) the selected shape's grips, edge/corner bands, then its box — so a small selected shape
  //      can be moved even when it sits on a bigger one;
  //  (b) the smallest shape whose exact box holds the point (ties: topmost);
  //  (c) thin lines and pixels within a few CSS px, smallest first;
  //  (d) full-screen shapes (Fill screen, background rects), topmost.
  function targetAt(x: number, y: number, unit: number): Target {
    if (selRow && movable && selBox && !isFullScreen(selBox)) {
      const reach = GRIP_HIT_CSS * unit;
      let best: { id: string; d: number } | null = null;
      for (const h of handles) {
        const d = Math.max(Math.abs(h.x - x), Math.abs(h.y - y));
        if (d <= reach && (!best || d < best.d)) best = { id: h.id, d };
      }
      if (best) return { kind: "handle", id: best.id };
      const edge = edgeHandleAt(selRow, x, y, EDGE_CSS * unit);
      if (edge) return { kind: "handle", id: edge };
      if (contains(selBox, x, y)) {
        const i = bounds.findIndex((b, j) => b && rowIds[j] === selRow.id);
        if (i >= 0) return { kind: "op", index: i };
      }
    }

    const smallest = (pick: (b: Box, i: number) => boolean) => {
      let found = -1, area = Infinity;
      for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        if (!b || !pick(b, i)) continue;
        const a = b.w * b.h;
        if (a <= area) {
          // `<=` so a later (topmost) op wins a tie.
          area = a;
          found = i;
        }
      }
      return found;
    };

    let i = smallest((b) => !isFullScreen(b) && contains(b, x, y));
    if (i < 0) {
      const pad = LINE_PAD_CSS * unit;
      i = smallest((b, j) => {
        const op = ops[j];
        const thin = (Array.isArray(op) && THIN_OPS.has(op[0] as string)) || Math.min(b.w, b.h) <= 2;
        return thin && !isFullScreen(b) && contains(b, x, y, pad);
      });
    }
    if (i < 0) {
      for (let j = bounds.length - 1; j >= 0; j--) {
        const b = bounds[j];
        if (b && isFullScreen(b) && contains(b, x, y)) {
          i = j;
          break;
        }
      }
    }
    return i >= 0 ? { kind: "op", index: i } : null;
  }

  function cursorOf(t: Target): string {
    if (!t) return "crosshair";
    if (t.kind === "handle") return cursorFor(t.id);
    const row = rowById.get(rowIds[t.index]);
    return row && canDrag(row) ? "grab" : "crosshair";
  }

  function begin(e: PointerEvent<Element>, c: HTMLCanvasElement, row: DrawRow, handle: string, unit: number) {
    drag.current = { pointerId: e.pointerId, handle, start: row, startX: e.clientX, startY: e.clientY, unit, lastDx: 0, lastDy: 0 };
    // Capture on the canvas so its hover readout keeps updating while dragging.
    c.setPointerCapture(e.pointerId);
    setDragHandle(handle);
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    const c = canvas();
    if (e.button !== 0 || !c) return;
    // Presses on our own buttons aren't canvas presses.
    if ((e.target as Element).closest("button")) return;
    const { x, y, unit } = pointOn(e, c);
    const t = targetAt(x, y, unit);
    const onScreen = x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT;
    // Grips poke out past the canvas; a press anywhere else off the screen (the device frame, the
    // full-screen editor's margins) just clears the selection.
    if (!onScreen && t?.kind !== "handle") {
      onSelect(null);
      return;
    }
    e.preventDefault();
    c.focus({ preventScroll: true });

    if (t?.kind === "handle") {
      if (selRow) begin(e, c, selRow, t.id, unit);
      return;
    }
    if (!t) {
      onSelect(null);
      return;
    }
    const row = rowById.get(rowIds[t.index]);
    if (!row) return;
    // The background (Fill screen, a full-screen rect) works like empty canvas while something else
    // is selected: the press deselects. With nothing selected it selects the background's row.
    const b = bounds[t.index];
    if (selectedId && row.id !== selectedId && b && isFullScreen(b)) {
      onSelect(null);
      return;
    }
    if (row.id !== selectedId) {
      onSelect(row.id);
      // Bring the row's card to the top of the visible area.
      requestAnimationFrame(() => {
        const card = document.querySelector<HTMLElement>(`[data-row-id="${row.id}"]`);
        if (!card) return;
        card.style.scrollMarginTop = "16px";
        card.scrollIntoView({ block: "start", behavior: full ? "auto" : "smooth" });
      });
    }
    if (canDrag(row)) begin(e, c, row, "move", unit);
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d) {
      if (e.pointerId !== d.pointerId) return;
      const dx = Math.round((e.clientX - d.startX) * d.unit);
      const dy = Math.round((e.clientY - d.startY) * d.unit);
      if (dx === d.lastDx && dy === d.lastDy) return;
      d.lastDx = dx;
      d.lastDy = dy;
      onRowChange(applyDrag(d.start, d.handle, dx, dy));
      return;
    }
    const c = canvas();
    if (!c) return;
    const { x, y, unit } = pointOn(e, c);
    const t = targetAt(x, y, unit);
    const onScreen = x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT;
    const next = onScreen || t?.kind === "handle" ? cursorOf(t) : "";
    if (next !== hoverCursor) setHoverCursor(next);
  }

  function end(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragHandle(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!selRow || !movable) return;
    const step = e.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    onRowChange(applyDrag(selRow, "move", delta[0], delta[1]));
  }

  const cursor = dragHandle ? (dragHandle === "move" ? "grabbing" : cursorFor(dragHandle)) : hoverCursor;

  // Overlay positions in whole device pixels so grips and the dashed box stay crisp at any zoom.
  const k = cssWidth / SCREEN_WIDTH;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const snap = (v: number) => Math.round(v * dpr) / dpr;

  const overlay =
    selBox && k > 0 ? (
      <>
        {/* Dashed selection box, 1px outside the shape; `difference` keeps it visible on any colour. */}
        <div
          className="absolute border-2 border-dashed border-white mix-blend-difference"
          style={{
            left: snap(selBox.x * k) - 3,
            top: snap(selBox.y * k) - 3,
            width: snap((selBox.x + selBox.w) * k) - snap(selBox.x * k) + 6,
            height: snap((selBox.y + selBox.h) * k) - snap(selBox.y * k) + 6,
          }}
        />
        {handles.map((h) => (
          <div
            key={h.id}
            className="absolute rounded-[1px] border border-[#111] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
            style={{
              left: snap(h.x * k) - GRIP_CSS / 2,
              top: snap(h.y * k) - GRIP_CSS / 2,
              width: GRIP_CSS,
              height: GRIP_CSS,
            }}
          />
        ))}
      </>
    ) : null;

  const hint = previewHint(selRow);

  const editor = (
    <div
      ref={observe}
      key={full ? "full" : "inline"}
      data-preview
      className={full ? "flex flex-col items-center" : "relative"}
      style={{ cursor: cursor || undefined }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => !drag.current && setHoverCursor("crosshair")}
    >
      <DevicePreview
        ops={ops}
        scale={full ? fullScale : INLINE_SCALE}
        overlay={overlay}
        onKeyDown={onKeyDown}
        cursor={cursor || "crosshair"}
        interactive
      />
      {full && <p className="mt-1 text-center text-[12px] text-[#a0a0a0]">{hint}</p>}
    </div>
  );

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center">
      {!full && editor}
      {full && (
        <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[#2e2e2e] text-[12px] text-muted">
          Editing in full screen
        </div>
      )}
      {full &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            data-full-editor
            aria-modal="true"
            aria-label="Full-screen preview editor"
            className="fixed inset-0 z-[100] flex flex-col bg-black/90 p-4 backdrop-blur-sm sm:p-6"
          >
            <div className="flex h-14 shrink-0 items-start justify-between">
              <span className="text-[13px] text-[#a0a0a0]">Full-screen editor · Esc to close</span>
              <button
                type="button"
                onClick={() => setFull(false)}
                title="Exit full screen (Esc)"
                aria-label="Exit full screen"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#1a1a1a] px-2.5 text-[13px] text-[#d0d0d0] hover:bg-[#262626] hover:text-white"
              >
                <Minimize2 size={14} /> Exit
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">{editor}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}
