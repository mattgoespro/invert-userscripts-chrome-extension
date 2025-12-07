import Box from '@mui/material/Box';
import { createStyled } from '../../theme';
import { CSSProperties } from '@mui/material';

type FlexRowProps = {
  wrap?: boolean;
  gap?: number;
} & CSSProperties;

export const FlexRow = createStyled(Box, {
  label: 'FlexRow',
  name: 'FlexRow',
  shouldForwardProp: (prop) => prop !== 'gap' && prop !== 'wrap' && prop !== 'margin',
})<FlexRowProps>(({ margin = 7, gap = 0, wrap = true, padding = 0, theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: theme.spacing(gap) ?? 0,
  padding: `${padding ?? 0}rem`,
  margin: `${margin ?? 0}rem`,
  flexWrap: wrap ? 'wrap' : undefined,
}));
