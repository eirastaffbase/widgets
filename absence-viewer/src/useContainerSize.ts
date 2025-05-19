import { useRef, useState, useLayoutEffect } from "react";

/**
 * Watches the size of a given container via ResizeObserver.
 * Returns { width, height } of the container in pixels.
 */
export function useContainerSize<T extends HTMLElement>(): [
  React.RefObject<T>,
  { width: number; height: number }
] {
  const containerRef = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Callback for whenever the container’s size changes
    const resizeObserver = new ResizeObserver((entries) => {
      if (!Array.isArray(entries)) return;
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(el);

    return () => {
      resizeObserver.unobserve(el);
      resizeObserver.disconnect();
    };
  }, []);

  return [containerRef, size];
}
