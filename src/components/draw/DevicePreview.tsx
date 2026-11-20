"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { SCREEN_HEIGHT, SCREEN_WIDTH, type WireOp } from "@/lib/draw/ops";
import { renderPreview } from "@/lib/draw/preview";

export default function DevicePreview({ ops, scale = 2 }: { ops: WireOp[]; scale?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) renderPreview(ctx, ops);
  }, [ops]);

  const onMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * SCREEN_WIDTH);
    const y = Math.floor(((e.clientY - r.top) / r.height) * SCREEN_HEIGHT);
    if (x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT) setHover({ x, y });
    else setHover(null);
  };

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="rounded-xl border border-[#2e2e2e] bg-[#111] p-3 shadow-[0_0_0_1px_#000_inset,0_8px_24px_rgba(0,0,0,0.45)]">
        <canvas
          ref={canvasRef}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          className="block max-w-full cursor-crosshair bg-black"
          style={{
            width: SCREEN_WIDTH * scale,
            aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}`,
            imageRendering: "pixelated",
          }}
          aria-label="Device screen preview"
          role="img"
        />
      </div>
      <div className="h-4 font-mono text-[12px] tabular-nums text-[#a0a0a0]">
        {hover ? `x ${hover.x}, y ${hover.y}` : `${SCREEN_WIDTH} × ${SCREEN_HEIGHT}`}
      </div>
    </div>
  );
}
