/** Shared action sizes. Geometry and typography tokens live in base.css. */
export const buttonSizes = {
  sm: "h-(--button-height-sm) px-2 text-(length:--button-font-size)",
  md: "h-(--button-height) px-2.5 text-(length:--button-font-size)",
  lg: "h-(--button-height-lg) px-3 text-xs",
} as const;

export const iconButtonSizes = {
  sm: "size-(--button-height-sm)",
  md: "size-(--button-height)",
  lg: "size-(--button-height-lg)",
} as const;

export const iconGlyphSizes = { sm: 14, md: 16, lg: 18 } as const;
