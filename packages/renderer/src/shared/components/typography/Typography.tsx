import { JSX, PropsWithChildren } from "react";
import "./Typography.scss";

type TypographyVariant =
  | "title"
  | "subtitle"
  | "section-title"
  | "body"
  | "button"
  | "caption"
  | "code";

type TypographyProps = PropsWithChildren<{
  variant?: TypographyVariant;
  className?: string;
}>;

export function Typography({ variant = "body", className, children }: TypographyProps) {
  let Tag: keyof JSX.IntrinsicElements = "p";

  switch (variant) {
    case "title":
      Tag = "h1";
      break;
    case "subtitle":
      Tag = "h2";
      break;
    case "section-title":
      Tag = "h3";
      break;
    case "button":
      Tag = "span";
      break;
    case "caption":
      Tag = "span";
      break;
    case "code":
      Tag = "code";
      break;
    case "body":
    default:
      Tag = "p";
      break;
  }

  const classes = [`typography typography--${variant}`, className].filter(Boolean).join(" ");

  return <Tag className={classes}>{children}</Tag>;
}
