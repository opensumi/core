import { Color, RGBA } from '../color';
import { registerColor } from '../utils';

export const inlineChatBackground = registerColor(
  'design.inlineChat.background',
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
  'design.inlineChat.borderColor',
  { dark: new Color(new RGBA(42, 51, 68, 0.9)), light: new Color(new RGBA(0, 0, 0, 0)), hcDark: null, hcLight: null },
  '',
  true,
);

export const inlineChatBoxShadow = registerColor(
  'design.inlineChat.boxShadow',
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
export const designTitleForeground = registerColor(
  'design.title.foreground',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.85)),
    light: new Color(new RGBA(21, 27, 33, 0.85)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const designTitleBackground = registerColor(
  'design.title.background',
  { dark: '#222830', light: '#f1f2f3', hcDark: null, hcLight: null },
  '',
  true,
);

// 正在输入、hover高亮
export const designTitleHoverForeground = registerColor(
  'design.text.hoverForeground',
  { dark: '#fff', light: '#151b21', hcDark: null, hcLight: null },
  '',
  true,
);

// 输入文本高亮样式
export const designTitleHighlightForeground = registerColor(
  'design.text.highlightForeground',
  { dark: '#fff', light: '#151b21', hcDark: null, hcLight: null },
  '',
  true,
);

// 辅助文本颜色
export const designTitlePlaceholderForeground = registerColor(
  'design.text.placeholderForeground',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.45)),
    light: new Color(new RGBA(21, 27, 33, 0.65)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// 常规文字、代码字段、标签、hover字段、
export const designTextForeground = registerColor(
  'design.text.foreground',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.65)),
    light: new Color(new RGBA(21, 27, 33, 0.65)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// 输入框失去焦点
export const desigInputForeground = registerColor(
  'design.input.foreground',
  { dark: new Color(new RGBA(255, 255, 255, 0.35)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// 输入框聚焦
export const desigInputFocusForeground = registerColor(
  'design.inputOption.activeForeground',
  {
    dark: new Color(new RGBA(60, 141, 255, 0.65)),
    light: new Color(new RGBA(60, 141, 255, 0.65)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// Tag 背景色，或者整块区域 hover 上去背景色
export const designBlockHoverBackground = registerColor(
  'design.block.hoverBackground',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.08)),
    light: new Color(new RGBA(21, 27, 33, 0.06)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// Tag 或者整块区域默认背景色
export const designBlockBackground = registerColor(
  'design.block.background',
  { dark: new Color(new RGBA(255, 255, 255, 0.05)), light: '#F4F6F8', hcDark: null, hcLight: null },
  '',
  true,
);

export const designIconForeground = registerColor(
  'design.icon.foreground',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.65)),
    light: '#90959A',
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// 线条颜色
export const designBorderColor = registerColor(
  'design.borderColor',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.08)),
    light: new Color(new RGBA(21, 27, 33, 0.08)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const designContainerBackground = registerColor(
  'design.container.background',
  { dark: '#222830', light: '#fff', hcDark: null, hcLight: null },
  '',
  true,
);

export const designMonacoBackground = registerColor(
  'design.monaco.background',
  { dark: '#151b21', light: '#fff', hcDark: null, hcLight: null },
  '',
  true,
);

export const designRceBackground = registerColor(
  'design.rce.background',
  {
    dark: new Color(new RGBA(60, 141, 255, 0.15)),
    light: new Color(new RGBA(60, 141, 255, 0.25)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const designChatInputBackground = registerColor(
  'design.chatInput.background',
  { dark: new Color(new RGBA(0, 0, 0, 0.25)), light: '#fff', hcDark: null, hcLight: null },
  '',
  true,
);

export const designBoxShadowPrimary = registerColor(
  'design.boxShadow.primary',
  { dark: new Color(new RGBA(0, 0, 0, 0.2)), light: new Color(new RGBA(0, 0, 0, 0.05)), hcDark: null, hcLight: null },
  '',
  true,
);

export const designBoxShadowSecondary = registerColor(
  'design.boxShadow.secondary',
  { dark: new Color(new RGBA(0, 0, 0, 0.4)), light: new Color(new RGBA(0, 0, 0, 0.08)), hcDark: null, hcLight: null },
  '',
  true,
);

export const designBoxShadowtTertiary = registerColor(
  'design.boxShadow.tertiary',
  { dark: new Color(new RGBA(0, 0, 0, 0.24)), light: new Color(new RGBA(0, 0, 0, 0.12)), hcDark: null, hcLight: null },
  '',
  true,
);

export const designTagBackground = registerColor(
  'design.tag.background',
  {
    dark: new Color(new RGBA(0, 141, 255, 0.25)),
    light: new Color(new RGBA(60, 141, 255, 0.2)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const designTagForeground = registerColor(
  'design.tag.foreground',
  { dark: '#3c8dff', light: '#3c8dff', hcDark: null, hcLight: null },
  '',
  true,
);

export const designLanguageBackground = registerColor(
  'design.language.background',
  { dark: '#2b333d', light: '#dbe4ee', hcDark: null, hcLight: null },
  '',
  true,
);

export const designSkeletonDecorationBackground = registerColor(
  'design.skeletonDecoration.background',
  { dark: '#312f24', light: '#312f24', hcDark: null, hcLight: null },
  '',
  true,
);

export const designSkeletonPlaceholderDecorationBackground = registerColor(
  'design.skeletonPlaceholderDecoration.background',
  { dark: '#1f2224', light: '#1f2224', hcDark: null, hcLight: null },
  '',
  true,
);
