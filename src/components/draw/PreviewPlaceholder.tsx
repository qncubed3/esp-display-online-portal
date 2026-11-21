import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/draw/ops";

// Same footprint as DevicePreview at scale 1 (bezel, screen, coordinates line), shown before a
// preview is drawn so the layout doesn't jump.
export default function PreviewPlaceholder() {
  return (
    <div className="inline-flex max-w-full flex-col items-center gap-2">
      <div className="max-w-full rounded-xl border border-[#2e2e2e] bg-[#111] p-3">
        <div className="max-w-full bg-black" style={{ width: SCREEN_WIDTH, aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}` }} />
      </div>
      <div className="h-4" />
    </div>
  );
}
