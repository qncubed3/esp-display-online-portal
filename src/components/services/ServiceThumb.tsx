"use client";

import { useEffect, useMemo } from "react";
import DevicePreview from "@/components/draw/DevicePreview";
import PreviewPlaceholder from "@/components/draw/PreviewPlaceholder";
import LazyMount from "@/components/templates/LazyMount";
import { toWireOps, type DrawRow } from "@/lib/draw/ops";
import { loadPreview, useCache } from "@/lib/store/cache";

// Runs the Service's saved Data code (via /api/preview, which shares get()'s response cache)
// and draws its saved screen. If the Data code fails, the screen is drawn with empty variables.
// The variables are cached for a minute, so coming back to My Services redraws straight away.
function Screen({ serviceId, rows }: { serviceId: string; rows: DrawRow[] }) {
  const preview = useCache((s) => s.previews[serviceId]);

  useEffect(() => {
    loadPreview(serviceId);
  }, [serviceId]);

  const ops = useMemo(() => (preview ? toWireOps(rows, preview.vars) : null), [rows, preview]);
  return ops ? <DevicePreview ops={ops} scale={1} /> : <PreviewPlaceholder />;
}

// A Service card's screen preview. Only fetched once the card nears the viewport, unless it's cached.
export default function ServiceThumb({ serviceId, rows }: { serviceId: string; rows: DrawRow[] }) {
  const cached = useCache((s) => serviceId in s.previews);
  if (cached) {
    return (
      <div className="min-w-0 max-w-full">
        <Screen serviceId={serviceId} rows={rows} />
      </div>
    );
  }
  return (
    <LazyMount placeholder={<PreviewPlaceholder />} className="min-w-0 max-w-full">
      <Screen serviceId={serviceId} rows={rows} />
    </LazyMount>
  );
}
