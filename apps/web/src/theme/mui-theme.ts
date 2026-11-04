'use client';
import { createTheme } from '@mui/material/styles';
import { fontFamily, textToken } from './typography';

export const theme = createTheme({
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
