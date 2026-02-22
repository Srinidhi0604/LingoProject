"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Orientation = "vertical" | "horizontal";

interface ResizableSplitProps {
  orientation: Orientation;
  first: ReactNode;
  second: ReactNode;
  size: number;
  onSizeChange: (next: number) => void;
  minFirst?: number;
  minSecond?: number;
  disabled?: boolean;
  className?: string;
  handleClassName?: string;
  firstClassName?: string;
  secondClassName?: string;
}

export default function ResizableSplit({
  orientation,
  first,
  second,
  size,
  onSizeChange,
  minFirst = 160,
  minSecond = 200,
  disabled = false,
  className,
  handleClassName,
  firstClassName,
  secondClassName,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const isVertical = orientation === "vertical";

  const clamp = useCallback(
    (value: number) => {
      const el = containerRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const total = isVertical ? rect.width : rect.height;
      const max = Math.max(minFirst, total - minSecond);
      return Math.min(Math.max(value, minFirst), max);
    },
    [isVertical, minFirst, minSecond]
  );

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setIsDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
    },
    [disabled, isVertical]
  );

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = isVertical ? e.clientX - rect.left : e.clientY - rect.top;
      onSizeChange(clamp(next));
    },
    [clamp, isVertical, onSizeChange]
  );

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stopDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [isDragging, onMove, stopDrag]);

  useEffect(() => {
    const onResize = () => {
      onSizeChange(clamp(size));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, onSizeChange, size]);

  const firstStyle = useMemo(() => {
    if (isVertical) return { width: `${size}px` };
    return { height: `${size}px` };
  }, [isVertical, size]);

  const handleBase = isVertical
    ? "w-1 cursor-col-resize"
    : "h-1 cursor-row-resize";

  return (
    <div
      ref={containerRef}
      className={
        className ||
        (isVertical
          ? "flex h-full w-full min-w-0"
          : "flex h-full w-full min-h-0 flex-col")
      }
    >
      <div style={firstStyle} className={firstClassName || "min-w-0 min-h-0"}>
        {first}
      </div>

      <div
        onPointerDown={startDrag}
        className={
          (handleClassName ||
            `${handleBase} bg-white/10 hover:bg-white/20 transition-colors touch-none`) +
          (disabled ? " opacity-50 pointer-events-none" : "")
        }
        role="separator"
        aria-orientation={orientation}
      />

      <div className={secondClassName || "flex-1 min-w-0 min-h-0"}>{second}</div>
    </div>
  );
}
