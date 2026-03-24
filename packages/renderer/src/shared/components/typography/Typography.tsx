import { JSX, PropsWithChildren } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const typographyVariants = cva("m-0", {
  variants: {
    variant: {
      title:
        "font-heading text-2xl font-semibold text-foreground leading-[1.2]",
      subtitle:
        "font-heading text-xl font-medium text-text-muted leading-[1.3]",
      "section-title":
        "font-mono text-[10px] font-semibold text-text-muted uppercase tracking-[0.05em] leading-[1.4]",
      body: "font-body text-sm font-normal text-text-muted leading-normal",
      button: "font-mono text-sm font-medium text-foreground leading-normal",
      caption:
        "font-body text-xs font-normal text-text-muted-strong leading-[1.4]",
      code: "font-mono text-sm font-normal text-foreground leading-[1.6] tracking-[-0.01em]",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

type TypographyProps = PropsWithChildren<
  {
    className?: string;
  } & VariantProps<typeof typographyVariants>
>;

export function Typography({
  variant = "body",
  className,
  children,
}: TypographyProps) {
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

  return (
    <Tag className={clsx(typographyVariants({ variant }), className)}>
      {children}
    </Tag>
  );
}
