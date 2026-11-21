"use client";

import { useEffect, useMemo, useState } from "react";
import DevicePreview from "@/components/draw/DevicePreview";
import PreviewPlaceholder from "@/components/draw/PreviewPlaceholder";
import LazyMount from "@/components/templates/LazyMount";
import { toWireOps, type DrawRow } from "@/lib/draw/ops";

type Vars = Record<string, string | number | boolean>;

// Runs the Service's saved Data code (via /api/preview, which shares get()'s response cache)
// and draws its saved screen. If the Data code fails, the screen is drawn with empty variables.
function Screen({ serviceId, rows }: { serviceId: string; rows: DrawRow[] }) {
  const [vars, setVars] = useState<Vars | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    })
      .then((r) => r.json())
      .then((b: { vars?: Vars }) => alive && setVars(b.vars ?? {}))
      .catch(() => alive && setVars({}));
    return () => {
      alive = false;
    };
  }, [serviceId]);

  const ops = useMemo(() => (vars ? toWireOps(rows, vars) : null), [rows, vars]);
  return ops ? <DevicePreview ops={ops} scale={1} /> : <PreviewPlaceholder />;
}

// A Service card's screen preview. Only fetched once the card nears the viewport.
export default function ServiceThumb({ serviceId, rows }: { serviceId: string; rows: DrawRow[] }) {
  return (
    <LazyMount placeholder={<PreviewPlaceholder />} className="min-w-0 max-w-full">
      <Screen serviceId={serviceId} rows={rows} />
    </LazyMount>
  );
}
