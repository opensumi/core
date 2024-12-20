import { registerColor, transparent } from '../utils';

import { defaultInsertColor, defaultRemoveColor } from './editor';

export const designInlineDiffAddedRange = registerColor(
  'aiNative.inlineDiffAddedRange',
  { dark: defaultInsertColor, light: defaultInsertColor, hcDark: null, hcLight: null },
  '',
  true,
);

export const designInlineDiffRemovedRange = registerColor(
  'aiNative.inlineDiffRemovedRange',
  { dark: defaultRemoveColor, light: defaultRemoveColor, hcDark: null, hcLight: null },
  '',
  true,
);

export const designInlineDiffAcceptPartialEdit = registerColor(
  'aiNative.inlineDiffAcceptPartialEdit',
  { dark: '#89d185', light: '#89d185', hcDark: null, hcLight: null },
  '',
  true,
);

export const designInlineDiffAcceptPartialEditForeground = registerColor(
  'aiNative.inlineDiffAcceptPartialEdit.foreground',
  { dark: '#1f1f1f', light: '#1f1f1f', hcDark: null, hcLight: null },
  '',
  true,
);

export const designInlineDiffDiscardPartialEdit = registerColor(
  'aiNative.inlineDiffDiscardPartialEdit',
  { dark: '#f14c4c', light: '#f14c4c', hcDark: null, hcLight: null },
  '',
  true,
);

/**
 * multi-line edits colors
 */
export const designMultiLineEditsDeletionsBackground = registerColor(
  'aiNative.multiLineEditsDeletionsBackground',
  { dark: defaultRemoveColor, light: defaultRemoveColor, hcDark: null, hcLight: null },
  '',
  true,
);

export const designMultiLineEditsAdditionsBackground = registerColor(
  'aiNative.multiLineEditsAdditionsBackground',
  { dark: defaultInsertColor, light: defaultInsertColor, hcDark: null, hcLight: null },
  '',
  true,
);
