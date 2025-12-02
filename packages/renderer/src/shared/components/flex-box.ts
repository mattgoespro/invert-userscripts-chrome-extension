import { CSSProperties } from "@mui/material";
import Box from "@mui/material/Box";
import { createStyled } from "../theme";

type FlexBoxProps = {
  direction: CSSProperties["flexDirection"];
  justify?: CSSProperties["justifyContent"];
  align?: CSSProperties["alignItems"];
  gap?: number;
  wrap?: boolean;
};

export const FlexBox = createStyled(Box, {
  label: "FlexBox",
  name: "FlexBox",
  shouldForwardProp: (prop: string) =>
    !["direction", "justify", "align", "margin", "padding", "gap", "wrap"].includes(prop)
})<FlexBoxProps>(({
  theme,
  direction = "column",
  justify = "flex-start",
  align = "flex-start",
  gap = 1,
  wrap = true
}) => {
  return {
    minWidth: theme.breakpoints.values.sm,
    display: "flex",
    flexDirection: direction,
    justifyContent: justify,
    alignItems: align,
    gap: theme.spacing(gap),
    flexWrap: wrap ? "wrap" : undefined
  };
});
