import { StackingLevelStr } from '@opensumi/ide-core-browser';

import { registerCSSVar } from './css-var';

// Register all stacking levels as CSS variables
Object.entries(StackingLevelStr).forEach(([key, value]) => {
  registerCSSVar(`stacking-level-${key.toLowerCase()}`, value);
});
