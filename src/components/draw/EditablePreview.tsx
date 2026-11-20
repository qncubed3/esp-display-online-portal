"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SCREEN_HEIGHT, SCREEN_WIDTH, type DrawRow, type WireOp } from "@/lib/draw/ops";
import { applyDrag, canDrag, handlesFor } from "@/lib/draw/geometry";
import { opBounds } from "@/lib/draw/preview";
import DevicePreview, { screenPoint } from "./DevicePreview";

const pctX = (x: number) => `${(x / SCREEN_WIDTH) * 100}%`;
const pctY = (y: number) => `${(y / SCREEN_HEIGHT) * 100}%`;

// How far outside a shape (in CSS pixels on the preview) a click still selects it.
const HIT_SLOP_CSS = 8;

interface Drag {
  pointerId: number;
  handle: string; // "move" or a handle id from handlesFor
  start: DrawRow;
  startX: number;
  startY: number;
  unit: number; // screen pixels per CSS pixel
  lastDx: number;
  lastDy: number;
}

// The Draw preview with MS Paint-style editing: click a shape to select its row, drag it to move,
// drag the handles to resize or reshape. Arrow keys nudge the selection (Shift: 10px).
export default function EditablePreview({
  rows,
  ops,
  rowIds,
  selectedId,
  onSelect,
  onRowChange,
}: {
  rows: DrawRow[];
  ops: WireOp[];
  /** The row each op came from (toWireOpsWithRows). */
  rowIds: string[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  onRowChange(row: DrawRow): void;
}) {
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const bounds = useMemo(() => opBounds(ops), [ops]);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  // A row can make several ops (e.g. "text"); its box is the one op that draws something.
  const selRow = selectedId ? rowById.get(selectedId) ?? null : null;
  const selBox = selRow ? (bounds.find((b, i) => b && rowIds[i] === selRow.id) ?? null) : null;
  const movable = selRow ? canDrag(selRow) : false;
  const handles = selRow && movable ? handlesFor(selRow) : [];

  function begin(e: PointerEvent<Element>, canvas: HTMLCanvasElement, row: DrawRow, handle: string) {
    const p = screenPoint(e, canvas);
    drag.current = { pointerId: e.pointerId, handle, start: row, startX: e.clientX, startY: e.clientY, unit: p.unit, lastDx: 0, lastDy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function move(e: PointerEvent<Element>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = Math.round((e.clientX - d.startX) * d.unit);
    const dy = Math.round((e.clientY - d.startY) * d.unit);
    if (dx === d.lastDx && dy === d.lastDy) return;
    d.lastDx = dx;
    d.lastDy = dy;
    onRowChange(applyDrag(d.start, d.handle, dx, dy));
  }

  function end(e: PointerEvent<Element>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  // Topmost (last drawn) shape under the pointer wins. Every box is padded by ~HIT_SLOP_CSS screen
  // pixels so thin lines and small shapes are easy to hit; full-screen ops (Fill screen, a
  // background rectangle) only count when nothing else is near, or they'd swallow every click.
  function hitTest(x: number, y: number, slop: number): number {
    let background = -1;
    for (let i = bounds.length - 1; i >= 0; i--) {
      const b = bounds[i];
      if (!b) continue;
      if (b.x <= 0 && b.y <= 0 && b.x + b.w >= SCREEN_WIDTH && b.y + b.h >= SCREEN_HEIGHT) {
        if (background < 0 && x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT) background = i;
        continue;
      }
      if (x >= b.x - slop && x < b.x + b.w + slop && y >= b.y - slop && y < b.y + b.h + slop) return i;
    }
    return background;
  }

  function onCanvasDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const { x, y, unit } = screenPoint(e, e.currentTarget);
    const hit = hitTest(x, y, Math.max(2, Math.round(HIT_SLOP_CSS * unit)));
    if (hit < 0) {
      onSelect(null);
      return;
    }
    const row = rowById.get(rowIds[hit]);
    if (!row) return;
    onSelect(row.id);
    // Bring the row's card to the top of the visible area.
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-row-id="${row.id}"]`);
      if (!card) return;
      card.style.scrollMarginTop = "16px";
      card.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    if (canDrag(row)) begin(e, e.currentTarget, row, "move");
  }

  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!selRow || !movable) return;
    const step = e.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    onRowChange(applyDrag(selRow, "move", delta[0], delta[1]));
  }

  const canvasOf = (el: Element) => el.closest("[data-preview]")?.querySelector("canvas") ?? null;

  const overlay = selBox ? (
    <>
      {/* Dashed selection box; `difference` keeps it visible on any colour. */}
      <div
        className="absolute border-2 border-dashed border-white mix-blend-difference"
        style={{
          left: pctX(selBox.x),
          top: pctY(selBox.y),
          // 1px gap on every side, then the 2px dashed border.
          width: `calc(${pctX(selBox.w)} + 2px)`,
          height: `calc(${pctY(selBox.h)} + 2px)`,
          margin: -3,
          boxSizing: "content-box",
        }}
      />
      {handles.map((h) => (
        <div
          key={h.id}
          onPointerDown={(e) => {
            const canvas = canvasOf(e.currentTarget);
            if (e.button !== 0 || !canvas || !selRow) return;
            e.stopPropagation();
            begin(e, canvas, selRow, h.id);
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-[2px] border border-black bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
          style={{ left: pctX(h.x + 0.5), top: pctY(h.y + 0.5), cursor: h.cursor }}
          title={h.id === "move" ? undefined : "Drag to reshape"}
        />
      ))}
    </>
  ) : null;

  return (
    <div data-preview onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <DevicePreview
        ops={ops}
        overlay={overlay}
        onPointerDown={onCanvasDown}
        onKeyDown={onKeyDown}
        cursor={dragging ? "grabbing" : "crosshair"}
      />
      <p className="mt-1 text-center text-[12px] text-muted">
        {selRow
          ? movable
            ? "Drag to move · handles to resize · arrow keys to nudge (Shift ×10)"
            : selRow.op === "fillScreen"
              ? "Fill screen covers the whole screen"
              : "Uses {variables} for its position, so it can't be dragged"
          : "Click a shape to select its row"}
      </p>
    </div>
  );
}
