import { forwardRef } from "react";
import "./CodeComment.scss";

type CodeCommentProps = {
  children: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "children">;

export const CodeComment = forwardRef<HTMLElement, CodeCommentProps>(
  ({ children, className = "", ...rest }, ref) => {
    return (
      <code ref={ref} className={`code-comment ${className}`.trim()} {...rest}>
        <span className="code-comment--prefix">//</span>
        <span className="code-comment--text">{children}</span>
      </code>
    );
  }
);
