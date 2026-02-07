import { useCallback, useEffect, useRef, useState } from "react";
import "./ResizeHandle.scss";

type ResizeHandleProps = {
  direction?: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
};

export function ResizeHandle({
  direction = "horizontal",
  onResize,
  onResizeEnd,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastPositionRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      lastPositionRef.current = direction === "horizontal" ? e.clientX : e.clientY;
    },
    [direction]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPosition = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPosition - lastPositionRef.current;
      lastPositionRef.current = currentPosition;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onResizeEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, direction, onResize, onResizeEnd]);

  return (
    <div
      className={`resize-handle resize-handle--${direction} ${isDragging ? "resize-handle--dragging" : ""}`}
      onMouseDown={handleMouseDown}
    >
      <div className="resize-handle--bar" />
    </div>
  );
}
