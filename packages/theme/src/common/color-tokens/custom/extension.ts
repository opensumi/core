import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';

export const ktStatusBarExtensionDebugginBackground = registerColor(
  'kt.statusBar.extensionDebuggingBackground',
  { dark: '#CC6633', light: '#CC6633', hcDark: '#CC6633', hcLight: null },
  localize('Background of StatusBar while extension is debugging.'),
);
