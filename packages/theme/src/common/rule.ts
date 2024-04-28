import { StackingLevel } from '@opensumi/ide-core-browser';

import { registerCSSVar } from '.';

Object.entries(StackingLevel).forEach(([key, value]) => {
  registerCSSVar(`stacking-level-${key.toLowerCase()}`, value.toString());
});
