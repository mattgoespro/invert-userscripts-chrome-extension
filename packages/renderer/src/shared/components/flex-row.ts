import Container, { ContainerProps } from "@mui/material/Container";
import { createStyled } from "../theme";

type FlexRowProps = {
  wrap?: boolean;
  gap?: number;
  margin?: number;
} & ContainerProps;

export const FlexRow = createStyled(Container, {
  label: "FlexRow",
  name: "FlexRow",
  shouldForwardProp: (prop) => prop !== "gap" && prop !== "wrap" && prop !== "margin"
})<FlexRowProps>(({ margin = 7, gap = 0, wrap = true, theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  gap: theme.spacing(gap) ?? 0,
  margin: margin ? `${margin}px` : undefined,
  flexWrap: wrap ? "wrap" : undefined
}));
