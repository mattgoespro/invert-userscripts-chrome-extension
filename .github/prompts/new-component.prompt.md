---
description: "Scaffold a new React component with the correct folder structure, CVA boilerplate, TypeScript types, and Tailwind classes following the project's conventions."
argument-hint: "ComponentName variant:primary,secondary [location]"
agent: "agent"
---

Create a new React component following the project's established patterns from [copilot-instructions.md](../copilot-instructions.md).

## Input

The user provides:

- **Component name** (PascalCase, e.g., `Tooltip`, `Badge`)
- **Variants** (optional, comma-separated, e.g., `variant:primary,secondary,danger`)
- **Location** (optional, defaults to `packages/renderer/src/shared/components/`)

## File Structure

Create a single file inside a `kebab-case` folder:

```
{location}/{kebab-case-name}/
  {PascalCase}.tsx
```

Example: `Tooltip` → `packages/renderer/src/shared/components/tooltip/Tooltip.tsx`

## Component Template

If the user specifies **variants**, scaffold with CVA:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const {name}Variants = cva(
  "base Tailwind utility classes",
  {
    variants: {
      variant: {
        // one key per user-specified variant
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

type {Name}Props = {
  children: React.ReactNode;
} & VariantProps<typeof {name}Variants> &
  React.HTMLAttributes<HTMLDivElement>;

export function {Name}({
  variant,
  className,
  children,
  ...rest
}: {Name}Props) {
  return (
    <div className={clsx({name}Variants({ variant }), className)} {...rest}>
      {children}
    </div>
  );
}
```

If **no variants** are specified, scaffold without CVA:

```tsx
import clsx from "clsx";

type {Name}Props = {
  children: React.ReactNode;
  className?: string;
};

export function {Name}({ children, className }: {Name}Props) {
  return (
    <div className={clsx("base Tailwind utility classes", className)}>
      {children}
    </div>
  );
}
```

## Rules

Follow these rules from the project conventions:

1. **Named exports only** — no default exports
2. **Accept `className` prop** — always forward it via `clsx()` for parent overrides
3. **Spread `...rest` props** — extend native HTML attributes and pass them through
4. **Use design token utilities** — `bg-surface-base`, `text-foreground`, `border-accent-border`, `rounded-default`, `gap-sm`, etc. Never hardcode colors
5. **Double quotes** — for all strings and JSX attributes
6. **`forwardRef`** — only if the component needs to expose a DOM ref
7. **No separate style files** — all styling via Tailwind utility classes in JSX
8. **Transitions** — use `transition-colors duration-150` for interactive elements

Reference these existing components as examples of the pattern:

- [Button.tsx](../../packages/renderer/src/shared/components/button/Button.tsx) — CVA with variants
- [EditorPanel.tsx](../../packages/renderer/src/shared/components/editor-panel/EditorPanel.tsx) — simple without CVA
- [IconButton.tsx](../../packages/renderer/src/shared/components/icon-button/IconButton.tsx) — CVA with `forwardRef`

## After Creation

Briefly confirm what was created and where. Do not create any additional files.
