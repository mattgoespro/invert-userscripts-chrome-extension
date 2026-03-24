import { forwardRef } from "react";
import clsx from "clsx";

type CodeCommentProps = {
  children: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "children">;

export const CodeComment = forwardRef<HTMLElement, CodeCommentProps>(
  ({ children, className = "", ...rest }, ref) => {
    return (
      <code
        ref={ref}
        className={clsx(
          "inline-flex items-center gap-2 font-mono text-sm font-normal",
          "leading-[1.6] tracking-[-0.01em] italic opacity-60 select-none",
          className
        )}
        {...rest}
      >
        <span className="text-syntax-comment not-italic">//</span>
        <span className="text-syntax-comment">{children}</span>
      </code>
    );
  }
);
