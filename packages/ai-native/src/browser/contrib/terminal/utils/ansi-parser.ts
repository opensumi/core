import ansiRegex from 'ansi-regex';

const DEFAULT_STYLE = {
  color: 0,
  isSpecialColor: false,
  isRgbColor: false,
  is256Color: false,

  bgColor: 0,
  isSpecialBg: false,
  isRgbBg: false,
  is256Bg: false,

  bold: false,
  underline: false,
};

export type TextStyle = typeof DEFAULT_STYLE;

export interface TextWithStyle extends TextStyle {
  content: string;
}

export enum StyleCode {
  RESET = 0,
  BOLD = 1,
  UNDERLINE = 4,
  RESET_BOLD = 22,
  RESET_UNDERLINE = 24,
}

export enum ColorCode {
  MODE_RGB = 2,
  MODE_256 = 5,

  BLACK = 30,
  RED = 31,
  GREEN = 32,
  YELLOW = 33,
  BLUE = 34,
  MAGENTA = 35,
  CYAN = 36,
  WHITE = 37,

  SPECIAL_COLOR_MODE = 38,
  RESET_COLOR = 39,

  BLACK_BG = 40,
  RED_BG = 41,
  GREEN_BG = 42,
  YELLOW_BG = 43,
  BLUE_BG = 44,
  MAGENTA_BG = 45,
  CYAN_BG = 46,
  WHITE_BG = 47,

  SPECIAL_BG_MODE = 48,
  RESET_BG = 49,

  BLACK_BRIGHT = 90,
  RED_BRIGHT = 91,
  GREEN_BRIGHT = 92,
  YELLOW_BRIGHT = 93,
  BLUE_BRIGHT = 94,
  MAGENTA_BRIGHT = 95,
  CYAN_BRIGHT = 96,
  WHITE_BRIGHT = 97,

  BLACK_HIGH_INTENSITY = 100,
  RED_HIGH_INTENSITY = 101,
  GREEN_HIGH_INTENSITY = 102,
  BLUE_HIGH_INTENSITY = 104,
  MAGENTA_HIGH_INTENSITY = 105,
  CYAN_HIGH_INTENSITY = 106,
  WHITE_HIGH_INTENSITY = 107,
}

function setColorStyle(code: number, currentStyle: TextStyle, colorType?: number) {
  if (currentStyle.isSpecialColor || currentStyle.isSpecialBg) {
    if (colorType === ColorCode.SPECIAL_COLOR_MODE) {
      currentStyle.color = code;
    } else {
      currentStyle.bgColor = code;
    }
  } else if (
    (code >= 30 && code <= 37) || // color
    (code >= 90 && code <= 97) // bright color
  ) {
    currentStyle.color = code;
  } else if (
    (code >= 40 && code <= 47) || // bgColor
    (code >= 100 && code <= 107) // bright bgColor
  ) {
    currentStyle.bgColor = code;
  }
}

export function ansiParser(text: string, style?: TextStyle) {
  const regex = ansiRegex();
  const parts: Array<TextWithStyle> = [];

  let match: RegExpExecArray | null;
  let currentPos = 0;
  const currentStyle = { ...(style || DEFAULT_STYLE) };

  while ((match = regex.exec(text))) {
    const content = text.slice(currentPos, match.index);
    if (content) {
      parts.push({ content, ...currentStyle });
    }

    // match style
    const matchStyleCode = match[0].slice(2, -1).split(';').map(Number);
    if (matchStyleCode.length) {
      for (let i = 0; i < matchStyleCode.length; i++) {
        const code = matchStyleCode[i];
        const preCode = matchStyleCode[i - 1];

        switch (code) {
          case StyleCode.RESET: // reset to default
            Object.assign(currentStyle, DEFAULT_STYLE);
            break;
          case StyleCode.BOLD: // bold
            currentStyle.bold = true;
            break;
          case StyleCode.UNDERLINE: // underline
            currentStyle.underline = true;
            break;
          case StyleCode.RESET_BOLD: // reset bold
            currentStyle.bold = false;
            break;
          case StyleCode.RESET_UNDERLINE: // reset underline
            currentStyle.underline = false;
            break;
          case ColorCode.RESET_COLOR: // reset color
            currentStyle.color = 0;
            break;
          case ColorCode.RESET_BG: // reset bg color
            currentStyle.bgColor = 0;
            break;
          case ColorCode.SPECIAL_COLOR_MODE: // special color mode
            currentStyle.isSpecialColor = true;
            break;
          case ColorCode.SPECIAL_BG_MODE: // special color mode
            currentStyle.isSpecialBg = true;
            break;
          case ColorCode.MODE_RGB: // rgb color mode
            // e.g: \x1b[38;2;255m preCode is 38
            if (preCode === ColorCode.SPECIAL_COLOR_MODE) {
              currentStyle.isRgbColor = true;
            } else {
              currentStyle.isRgbBg = true;
            }
            break;
          case ColorCode.MODE_256: // 256 color mode
            // e.g: \x1b[48;5;255m preCode is 48
            if (preCode === ColorCode.SPECIAL_COLOR_MODE) {
              currentStyle.is256Color = true;
            } else {
              currentStyle.is256Bg = true;
            }
            break;
          default:
            setColorStyle(code, currentStyle, matchStyleCode[i - 2]);
        }
      }
    }

    currentPos = match.index + match[0].length;
  }

  const remainingText = text.slice(currentPos);
  if (remainingText) {
    parts.push({ content: remainingText, ...currentStyle });
  }

  return {
    parts,
    currentStyle,
  };
}

export function isRedColor(style: TextStyle) {
  const { color, isSpecialColor, is256Color } = style;
  if (isSpecialColor) {
    if (is256Color) {
      return color === 1 || color === 9 || (color >= 160 && color <= 196);
    } else {
      return color === 255;
    }
  }

  return color === ColorCode.RED || color === ColorCode.RED_BRIGHT;
}
