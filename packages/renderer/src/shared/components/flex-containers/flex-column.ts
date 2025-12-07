import Box from '@mui/material/Box';
import { createStyled } from '../../theme';

type FlexColumnProps = {
  centerVertical?: boolean;
  centerHorizontal?: boolean;
  grow?: boolean;
} & React.CSSProperties;

export const FlexColumn = createStyled(Box, {
  label: 'FlexColumn',
  name: 'FlexColumn',
  slot: 'Root',
  target: 'FlexColumn',
  shouldForwardProp: (prop) =>
    prop !== 'centerVertical' && prop !== 'centerHorizontal' && prop !== 'grow',
})<FlexColumnProps>(({ centerVertical, centerHorizontal, grow }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: centerVertical ? 'center' : undefined,
  alignItems: centerHorizontal ? 'center' : 'stretch',
  flex: (grow ?? true) ? 1 : undefined,
}));
