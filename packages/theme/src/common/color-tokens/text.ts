import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../color-registry';

// ------ text colors
export const textSeparatorForeground = registerColor(
  'textSeparator.foreground',
  { light: '#0000002e', dark: '#ffffff2e', hc: Color.black },
  localize('textSeparatorForeground', 'Color for text separators.'),
);
export const textLinkForeground = registerColor(
  'textLink.foreground',
  { light: '#006AB1', dark: '#3794FF', hc: '#3794FF' },
  localize('textLinkForeground', 'Foreground color for links in text.'),
);
export const textLinkActiveForeground = registerColor(
  'textLink.activeForeground',
  { light: '#006AB1', dark: '#3794FF', hc: '#3794FF' },
  localize('textLinkActiveForeground', 'Foreground color for links in text when clicked on and on mouse hover.'),
);
export const textPreformatForeground = registerColor(
  'textPreformat.foreground',
  { light: '#A31515', dark: '#D7BA7D', hc: '#D7BA7D' },
  localize('textPreformatForeground', 'Foreground color for preformatted text segments.'),
);
export const textBlockQuoteBackground = registerColor(
  'textBlockQuote.background',
  { light: '#7f7f7f1a', dark: '#7f7f7f1a', hc: null },
  localize('textBlockQuoteBackground', 'Background color for block quotes in text.'),
);
export const textBlockQuoteBorder = registerColor(
  'textBlockQuote.border',
  { light: '#007acc80', dark: '#007acc80', hc: Color.white },
  localize('textBlockQuoteBorder', 'Border color for block quotes in text.'),
);
export const textCodeBlockBackground = registerColor(
  'textCodeBlock.background',
  { light: '#dcdcdc66', dark: '#0a0a0a66', hc: Color.black },
  localize('textCodeBlockBackground', 'Background color for code blocks in text.'),
);
