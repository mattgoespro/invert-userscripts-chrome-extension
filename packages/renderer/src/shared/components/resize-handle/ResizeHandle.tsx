import { Separator } from "react-resizable-panels";
import "./ResizeHandle.scss";
import { forwardRef } from "react";

type ResizeHandleProps = {
  direction?: "horizontal" | "vertical";
};

/**
 * Styled wrapper around a {@linkcode Separator} component from `react-resizable-panels` that uses a Visual Studio Code-style invisible
 * hit area with accent highlight on hover/drag.
 */
export const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ direction = "horizontal" }, ref) => {
    return <Separator elementRef={ref} className={`resize-handle resize-handle--${direction}`} />;
  }
);
