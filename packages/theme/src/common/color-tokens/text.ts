import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../utils';

// ------ text colors
export const textSeparatorForeground = registerColor(
  'textSeparator.foreground',
  { light: '#0000002e', dark: '#ffffff2e', hcDark: Color.black, hcLight: '#292929' },
  localize('textSeparatorForeground', 'Color for text separators.'),
);
export const textLinkForeground = registerColor(
  'textLink.foreground',
  { light: '#006AB1', dark: '#3794FF', hcDark: '#3794FF', hcLight: '#0F4A85' },
  localize('textLinkForeground', 'Foreground color for links in text.'),
);
export const textLinkActiveForeground = registerColor(
  'textLink.activeForeground',
  { light: '#006AB1', dark: '#3794FF', hcDark: '#3794FF', hcLight: '#0F4A85' },
  localize('textLinkActiveForeground', 'Foreground color for links in text when clicked on and on mouse hover.'),
);
export const textPreformatForeground = registerColor(
  'textPreformat.foreground',
  { light: '#A31515', dark: '#D7BA7D', hcDark: '#D7BA7D', hcLight: '#292929' },
  localize('textPreformatForeground', 'Foreground color for preformatted text segments.'),
);
export const textBlockQuoteBackground = registerColor(
  'textBlockQuote.background',
  { light: '#7f7f7f1a', dark: '#7f7f7f1a', hcDark: null, hcLight: '#F2F2F2' },
  localize('textBlockQuoteBackground', 'Background color for block quotes in text.'),
);
export const textBlockQuoteBorder = registerColor(
  'textBlockQuote.border',
  { light: '#007acc80', dark: '#007acc80', hcDark: Color.white, hcLight: '#292929' },
  localize('textBlockQuoteBorder', 'Border color for block quotes in text.'),
);
export const textCodeBlockBackground = registerColor(
  'textCodeBlock.background',
  { light: '#dcdcdc66', dark: '#0a0a0a66', hcDark: Color.black, hcLight: '#F2F2F2' },
  localize('textCodeBlockBackground', 'Background color for code blocks in text.'),
);
