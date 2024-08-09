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
  { dark: transparent(defaultInsertColor, 3), light: transparent(defaultInsertColor, 3), hcDark: null, hcLight: null },
  '',
  true,
);

export const designInlineDiffAcceptPartialEditForeground = registerColor(
  'aiNative.inlineDiffAcceptPartialEdit.foreground',
  { dark: '#fff', light: '#fff', hcDark: null, hcLight: null },
  '',
  true,
);

export const designInlineDiffDiscardPartialEdit = registerColor(
  'aiNative.inlineDiffDiscardPartialEdit',
  { dark: transparent(defaultRemoveColor, 3), light: transparent(defaultRemoveColor, 3), hcDark: null, hcLight: null },
  '',
  true,
);
