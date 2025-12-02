import Container, { ContainerProps } from "@mui/material/Container";
import { createStyled } from "../theme";

type FlexColumnProps = {
  centerVertical?: boolean;
  centerHorizontal?: boolean;
  padding?: number;
  margin?: number;
} & ContainerProps;

export const FlexColumn = createStyled(Container, {
  label: "FlexColumn",
  name: "FlexColumn",
  slot: "Root",
  shouldForwardProp: (prop) =>
    prop !== "centerVertical" &&
    prop !== "centerHorizontal" &&
    prop !== "padding" &&
    prop !== "margin"
})<FlexColumnProps>(({ centerVertical, centerHorizontal, padding, margin }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: centerHorizontal ? "center" : undefined,
  alignItems: centerVertical ? "center" : "stretch",
  padding: `${padding ?? 0}rem`,
  margin: `${margin ?? 0}rem`
}));
