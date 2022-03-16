import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';

export const ktStatusBarExtensionDebugginBackground = registerColor(
  'kt.statusBar.extensionDebuggingBackground',
  { dark: '#CC6633', light: '#CC6633', hc: '#CC6633' },
  localize('Background of StatusBar while extension is debugging.'),
);
