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

// 常规文字、标题、文件夹标题
export const inlineChatTextCommon = registerColor(
  'ai.native.text.color.common',
  { dark: new Color(new RGBA(255, 255, 255, 0.85)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 正在输入、hover高亮
export const inlineChatTextHover = registerColor(
  'ai.native.text.color.hover',
  { dark: '#fff', light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 正在输入、hover高亮
export const inlineChatTextHighlight = registerColor(
  'ai.native.text.color.highlight',
  { dark: '#fff', light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 禁用
export const inlineChatTextDisable = registerColor(
  'ai.native.text.color.disabled',
  { dark: new Color(new RGBA(255, 255, 255, 0.16)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 辅助
export const inlineChatTextOther = registerColor(
  'ai.native.text.color.other',
  { dark: new Color(new RGBA(255, 255, 255, 0.45)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 常规文字、代码字段、标签、hover字段、
export const inlineChatTextNormal = registerColor(
  'ai.native.text.color.normal',
  { dark: new Color(new RGBA(255, 255, 255, 0.65)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 输入框失去焦点
export const inlineChatInputBlur = registerColor(
  'ai.native.input.color',
  { dark: new Color(new RGBA(255, 255, 255, 0.35)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 输入框失去焦点
export const inlineChatInputBackground = registerColor(
  'ai.native.input.background',
  { dark: '#151b21', light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// Icon、按钮hover背景色
export const aiNativeBlockBackgroundHover = registerColor(
  'ai.native.block.background.hover',
  { dark: new Color(new RGBA(255, 255, 255, 0.65)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// tag背景色，或者整块区域hover上去背景色
export const inlineChatBlockBackgroundCommon = registerColor(
  'ai.native.block.background.common',
  { dark: new Color(new RGBA(255, 255, 255, 0.08)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// tag背景色，或者整块区域hover上去背景色
export const inlineChatBlockBackgroundNormal = registerColor(
  'ai.native.block.background.normal',
  { dark: new Color(new RGBA(255, 255, 255, 0.05)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

export const aiNativeIconColor = registerColor(
  'ai.native.icon.color',
  { dark: new Color(new RGBA(255, 255, 255, 0.25)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 线条颜色
export const aiNativeBorderColor = registerColor(
  'ai.native.border.color',
  { dark: new Color(new RGBA(255, 255, 255, 0.08)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

export const aiNativeBorderColorCommon = registerColor(
  'ai.native.border.color.common',
  { dark: new Color(new RGBA(255, 255, 255, 0.35)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

export const aiNativeBorderColorNormal = registerColor(
  'ai.native.border.color.normal',
  { dark: new Color(new RGBA(255, 255, 255, 0.25)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

export const aiNativeContainerBackground = registerColor(
  'ai.native.container.background',
  { dark: '#222830', light: null, hcDark: null, hcLight: null },
  '',
  true,
);

export const aiNativeMonacoBackground = registerColor(
  'ai.native.monaco.background',
  { dark: '#151b21', light: '#fff', hcDark: null, hcLight: null },
  '',
  true,
);
