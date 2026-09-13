import { Separator } from "react-resizable-panels";
import { forwardRef } from "react";

type ResizeHandleProps = {
  direction?: "horizontal" | "vertical";
};

/**
 * Styled wrapper around a {@linkcode Separator} from `react-resizable-panels`.
 * Always shows a 1px split line; the hit area lights accent on hover/drag.
 */
export const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ direction = "horizontal" }, ref) => {
    return (
      <Separator
        elementRef={ref}
        className={`resize-handle resize-handle--${direction}`}
      />
    );
  }
);
