"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Renders `children` only once the placeholder comes near the viewport (then keeps them), so a
// grid of ~100 template previews doesn't paint 100 canvases up front. Observes against the
// nearest scrolling ancestor, so it works inside scrolling dialogs as well as the page.
export default function LazyMount({
  children,
  placeholder,
  className,
  rootMargin = "300px",
}: {
  children: ReactNode;
  /** Same size as `children`, so the layout doesn't jump when they mount. */
  placeholder: ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    let root: Element | null = el.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { root, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {shown ? children : placeholder}
    </div>
  );
}
