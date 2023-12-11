import { Color, RGBA } from '../color';
import { registerColor } from '../utils';

export const inlineChatBackground = registerColor(
  'ai.native.inlineChat.background',
  {
    dark: new Color(new RGBA(27, 35, 43, 1)),
    light: new Color(new RGBA(237, 245, 255, 1)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const inlineChatBorderColor = registerColor(
  'ai.native.inlineChat.border.color',
  { dark: new Color(new RGBA(42, 51, 68, 0.9)), light: new Color(new RGBA(0, 0, 0, 0)), hcDark: null, hcLight: null },
  '',
  true,
);

export const inlineChatBoxShadow = registerColor(
  'ai.native.inlineChat.box.shadow',
  {
    dark: new Color(new RGBA(0, 0, 0, 0.24)),
    light: new Color(new RGBA(0, 10, 26, 0.08)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const inlineChatTextColor = registerColor(
  'ai.native.inlineChat.text.color',
  { dark: '#bbbbbb', light: new Color(new RGBA(0, 10, 26, 0.68)), hcDark: null, hcLight: null },
  '',
  true,
);

export const inlineChatVerticalBackground = registerColor(
  'ai.native.inlineChat.vertical.background',
  { dark: '#363940', light: new Color(new RGBA(0, 10, 26, 0.11)), hcDark: null, hcLight: null },
  '',
  true,
);
