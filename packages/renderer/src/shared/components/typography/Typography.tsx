import { PropsWithChildren } from 'react';

type TypographyProps = PropsWithChildren<{
  variant?: 'title' | 'subtitle' | 'body' | 'button' | 'caption';
}>;

export function Typography({ variant = 'body', children }: TypographyProps) {
  let Tag = null;

  switch (variant) {
    case 'title':
      Tag = 'h1';
      break;
    case 'subtitle':
      Tag = 'h2';
      break;
    case 'button':
      Tag = 'span';
      break;
    case 'caption':
      Tag = 'span';
      break;
    case 'body':
    default:
      Tag = 'p';
      break;
  }

  return <Tag className={`typography typography--${variant}`}>{children}</Tag>;
}
