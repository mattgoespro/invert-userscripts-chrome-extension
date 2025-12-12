import { PropsWithChildren } from 'react';

type TypographyProps = PropsWithChildren<{
  variant?: 'title' | 'subtitle' | 'body' | 'caption';
}>;

export function Typography({ variant = 'body', children }: TypographyProps) {
  const Tag =
    variant === 'title'
      ? 'h1'
      : variant === 'subtitle'
        ? 'h2'
        : variant === 'caption'
          ? 'span'
          : 'p';

  return <Tag className={`typography typography--${variant}`}>{children}</Tag>;
}
