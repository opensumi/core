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
  'design.inlineChat.border.color',
  { dark: new Color(new RGBA(42, 51, 68, 0.9)), light: new Color(new RGBA(0, 0, 0, 0)), hcDark: null, hcLight: null },
  '',
  true,
);

export const inlineChatBoxShadow = registerColor(
  'design.inlineChat.box.shadow',
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
  'design.text.color.common',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.85)),
    light: new Color(new RGBA(21, 27, 33, 0.85)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// 正在输入、hover高亮
export const inlineChatTextHover = registerColor(
  'design.text.color.hover',
  { dark: '#fff', light: '#151b21', hcDark: null, hcLight: null },
  '',
  true,
);

// 正在输入、hover高亮
export const inlineChatTextHighlight = registerColor(
  'design.text.color.highlight',
  { dark: '#fff', light: '#151b21', hcDark: null, hcLight: null },
  '',
  true,
);

// 辅助
export const inlineChatTextOther = registerColor(
  'design.text.color.other',
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
export const inlineChatTextNormal = registerColor(
  'design.text.color.normal',
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
export const inlineChatInputBlur = registerColor(
  'design.input.color',
  { dark: new Color(new RGBA(255, 255, 255, 0.35)), light: null, hcDark: null, hcLight: null },
  '',
  true,
);

// Icon背景色
export const designNativeBlockBackgroundlight = registerColor(
  'design.block.background.light',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.45)),
    light: new Color(new RGBA(21, 27, 33, 0.65)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// tag背景色，或者整块区域hover上去背景色
export const inlineChatBlockBackgroundCommon = registerColor(
  'design.block.background.common',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.08)),
    light: new Color(new RGBA(21, 27, 33, 0.06)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

// tag背景色，或者整块区域hover上去背景色
export const inlineChatBlockBackgroundNormal = registerColor(
  'design.block.background.normal',
  { dark: new Color(new RGBA(255, 255, 255, 0.05)), light: '#F4F6F8', hcDark: null, hcLight: null },
  '',
  true,
);

export const designIconColor = registerColor(
  'design.icon.color',
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
  'design.border.color',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.08)),
    light: new Color(new RGBA(21, 27, 33, 0.08)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const designBorderColorCommon = registerColor(
  'design.border.color.common',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.35)),
    light: new Color(new RGBA(21, 27, 33, 0.85)),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

export const designBorderColorNormal = registerColor(
  'design.border.color.normal',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.12)),
    light: new Color(new RGBA(21, 27, 33, 0.12)),
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

export const designTitleBackground = registerColor(
  'design.title.background',
  { dark: '#222830', light: '#f1f2f3', hcDark: null, hcLight: null },
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

export const designCharInputBackground = registerColor(
  'design.charinput.background',
  { dark: new Color(new RGBA(255, 255, 255, 0.08)), light: '#fff', hcDark: null, hcLight: null },
  '',
  true,
);

export const designBoxShadow1 = registerColor(
  'design.boxShadow.color1',
  { dark: new Color(new RGBA(0, 0, 0, 0.2)), light: new Color(new RGBA(0, 0, 0, 0.05)), hcDark: null, hcLight: null },
  '',
  true,
);

export const designBoxShadow2 = registerColor(
  'design.boxShadow.color2',
  { dark: new Color(new RGBA(0, 0, 0, 0.4)), light: new Color(new RGBA(0, 0, 0, 0.08)), hcDark: null, hcLight: null },
  '',
  true,
);

export const designBoxShadow3 = registerColor(
  'design.boxShadow.color3',
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
