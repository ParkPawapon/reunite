'use client';
import { createTheme } from '@mui/material/styles';
import { fontFamily, textToken } from './typography';
import { colorPrimitives, semanticColor } from './colors';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: semanticColor('action-primary'),
      dark: semanticColor('action-hover'),
      light: colorPrimitives['orange-400'],
      contrastText: semanticColor('on-action'),
    },
    secondary: {
      main: semanticColor('action-secondary'),
      contrastText: semanticColor('on-secondary'),
    },
    background: {
      default: semanticColor('background'),
      paper: semanticColor('surface'),
    },
    text: {
      primary: semanticColor('text'),
      secondary: semanticColor('text-muted'),
    },
    divider: semanticColor('border'),
    success: { main: semanticColor('success') },
    warning: { main: semanticColor('warning') },
    error: { main: semanticColor('danger') },
    info: { main: semanticColor('information') },
  },
  typography: {
    fontFamily,
    fontWeightLight: 400,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: textToken('h1'),
    h2: textToken('h2'),
    h3: textToken('h3'),
    h4: textToken('h4'),
    h5: textToken('h5'),
    h6: textToken('h5'),
    subtitle1: textToken('body-lg'),
    subtitle2: textToken('body-sm'),
    body1: textToken('body'),
    body2: textToken('body-sm'),
    caption: textToken('caption'),
    overline: textToken('caption'),
    button: { ...textToken('button'), textTransform: 'none' },
  },
});
