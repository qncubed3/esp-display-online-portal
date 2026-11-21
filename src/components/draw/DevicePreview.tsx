"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { SCREEN_HEIGHT, SCREEN_WIDTH, type WireOp } from "@/lib/draw/ops";
import { renderPreview } from "@/lib/draw/preview";

// Screen pixel under a pointer event on the canvas (may be outside 0..W/H while dragging).
export function screenPoint(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((e.clientX - r.left) / r.width) * SCREEN_WIDTH),
    y: Math.floor(((e.clientY - r.top) / r.height) * SCREEN_HEIGHT),
    // Screen pixels per CSS pixel, for turning pointer movement into screen pixels.
    unit: SCREEN_WIDTH / r.width,
  };
}

export default function DevicePreview({
  ops,
  scale = 2,
  overlay,
  onPointerDown,
  onKeyDown,
  cursor = "crosshair",
  interactive = false,
  rotated180 = false,
}: {
  ops: WireOp[];
  scale?: number;
  /** Drawn over the screen, positioned in % of the 320×240 screen. */
  overlay?: ReactNode;
  onPointerDown?(e: PointerEvent<HTMLCanvasElement>): void;
  onKeyDown?(e: KeyboardEvent<HTMLCanvasElement>): void;
  cursor?: string;
  /** Dragging on it edits the screen, so touch gestures must not scroll the page. Off for thumbnails. */
  interactive?: boolean;
  /** Show the screen turned 180°, as a device rotated 180° shows it to someone facing it. Not for editing. */
  rotated180?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) renderPreview(ctx, ops);
  }, [ops]);

  const onMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = screenPoint(e, e.currentTarget);
    if (x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT) setHover({ x, y });
    else setHover(null);
  };

  return (
    <div className="inline-flex max-w-full flex-col items-center gap-2">
      <div className="max-w-full rounded-xl border border-[#2e2e2e] bg-[#111] p-3 shadow-[0_0_0_1px_#000_inset,0_8px_24px_rgba(0,0,0,0.45)]">
        <div className={`relative ${rotated180 ? "rotate-180" : ""}`}>
          <canvas
            ref={canvasRef}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            tabIndex={onKeyDown ? 0 : undefined}
            className={`block max-w-full bg-black outline-none ${interactive ? "touch-none" : ""}`}
            style={{
              width: SCREEN_WIDTH * scale,
              aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}`,
              imageRendering: "pixelated",
              cursor,
            }}
            aria-label="Device screen preview"
            role="img"
          />
          {overlay && <div className="pointer-events-none absolute inset-0 overflow-visible">{overlay}</div>}
        </div>
      </div>
      <div className="h-4 font-mono text-[12px] tabular-nums text-[#a0a0a0]">
        {hover ? `x ${hover.x}, y ${hover.y}` : `${SCREEN_WIDTH} × ${SCREEN_HEIGHT}`}
      </div>
    </div>
  );
}
