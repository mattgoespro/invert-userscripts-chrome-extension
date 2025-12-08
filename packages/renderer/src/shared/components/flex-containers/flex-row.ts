import Box from '@mui/material/Box';
import { createStyled } from '../../theme';
import { CSSProperties } from '@mui/material';

type FlexRowProps = {
  wrap?: boolean;
  gap?: number;
  grow?: boolean;
} & CSSProperties;

export const FlexRow = createStyled(Box, {
  label: 'FlexRow',
  name: 'FlexRow',

  shouldForwardProp: (prop) => !['gap', 'wrap', 'grow'].includes(prop.toString()),
})<FlexRowProps>(({ wrap = true, gap = 0, grow = true, theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: theme.spacing(gap) ?? 0,
  flexWrap: wrap ? 'wrap' : undefined,
  flexGrow: grow ? 1 : undefined,
}));
