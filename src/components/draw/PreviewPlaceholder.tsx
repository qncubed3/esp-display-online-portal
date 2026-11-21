import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/draw/ops";

// Same footprint as DevicePreview at scale 1 (bezel, screen, coordinates line), shown while a
// preview loads so the layout doesn't jump. The screen shimmers so it reads as loading, not as a
// blank (black) screen.
export default function PreviewPlaceholder() {
  return (
    <div role="status" aria-label="Loading preview" className="inline-flex max-w-full flex-col items-center gap-2">
      <div className="max-w-full rounded-xl border border-[#2e2e2e] bg-[#111] p-3">
        <div className="skeleton-screen max-w-full" style={{ width: SCREEN_WIDTH, aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}` }} />
      </div>
      <div className="h-4" />
    </div>
  );
}
