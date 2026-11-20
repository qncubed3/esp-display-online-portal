"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { OP_BY_NAME, SCREEN_HEIGHT, SCREEN_WIDTH, type DrawRow, type WireOp } from "@/lib/draw/ops";
import { applyDrag, canDrag, handlesFor } from "@/lib/draw/geometry";
import { opBounds } from "@/lib/draw/preview";
import DevicePreview, { screenPoint } from "./DevicePreview";

const pctX = (x: number) => `${(x / SCREEN_WIDTH) * 100}%`;
const pctY = (y: number) => `${(y / SCREEN_HEIGHT) * 100}%`;

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
  selectedId,
  onSelect,
  onRowChange,
}: {
  rows: DrawRow[];
  ops: WireOp[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  onRowChange(row: DrawRow): void;
}) {
  // toWireOps skips unknown ops, so op i belongs to the i-th row with a known op.
  const opRows = useMemo(() => rows.filter((r) => OP_BY_NAME[r.op]), [rows]);
  const bounds = useMemo(() => opBounds(ops), [ops]);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const selIndex = opRows.findIndex((r) => r.id === selectedId);
  const selRow = selIndex >= 0 ? opRows[selIndex] : null;
  const selBox = selIndex >= 0 ? bounds[selIndex] : null;
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

  // Topmost (last drawn) shape under the pointer wins.
  function onCanvasDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const { x, y } = screenPoint(e, e.currentTarget);
    let hit = -1;
    for (let i = bounds.length - 1; i >= 0; i--) {
      const b = bounds[i];
      if (b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) {
        hit = i;
        break;
      }
    }
    if (hit < 0) {
      onSelect(null);
      return;
    }
    const row = opRows[hit];
    onSelect(row.id);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-row-id="${row.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
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
        className="absolute border border-dashed border-white mix-blend-difference"
        style={{
          left: pctX(selBox.x),
          top: pctY(selBox.y),
          width: pctX(selBox.w),
          height: pctY(selBox.h),
          margin: -1,
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
          className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 touch-none border border-black bg-white"
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
