import kebabCase from 'lodash/kebabCase';

import { StackingLevelStr } from '@opensumi/ide-core-browser';

import { registerCSSVar } from './css-var';

// Register all stacking levels as CSS variables
// e.g. --stacking-level-background: 0;
// e.g. --stacking-level-popover-component: 10000;
Object.entries(StackingLevelStr).forEach(([key, value]) => {
  registerCSSVar(`stacking-level-${kebabCase(key).toLowerCase()}`, value);
});
