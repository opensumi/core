import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../color';
import { registerColor } from '../../color-registry';

export const ktTextSeparatorBackground = registerColor(
  'kt.textSeparator.background',
  { light: '#0000002e', dark: '#ffffff2e', hc: Color.black },
  localize('textSeparatorBackground', 'Background color for text separators.'),
);
