/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/debug/browser/debugANSIHandling.ts

import { ansiColorIdentifiers } from '@opensumi/ide-terminal-next/lib/browser/terminal.color';
import { Color, IThemeService, RGBA } from '@opensumi/ide-theme';
import { IWorkspaceFolder } from '@opensumi/monaco-editor-core/esm/vs/platform/workspace/common/workspace';

import { LinkDetector } from './debug-link-detector';
import styles from './view/console/debug-console.module.less';

/**
 * @param text
 * @returns 返回带有 style 样式和 linkDetector 的 span 标签
 */
export async function handleANSIOutput(
  text: string,
  linkDetector: LinkDetector,
  themeService: IThemeService,
  workspaceFolder: IWorkspaceFolder | undefined,
): Promise<HTMLSpanElement> {
  const root: HTMLSpanElement = document.createElement('span');
  const textLength: number = text.length;

  let styleNames: string[] = [];
  let customFgColor: RGBA | undefined;
  let customBgColor: RGBA | undefined;
  let customUnderlineColor: RGBA | undefined;
  let colorsInverted = false;
  let currentPos = 0;
  let buffer = '';

  while (currentPos < textLength) {
    let isSequenceFound = false;

    /**
     * 可能是 ANSI 转义序列.
     * @see {@link https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97 }
     */
    if (text.charCodeAt(currentPos) === 27 && text.charAt(currentPos + 1) === '[') {
      const startPos: number = currentPos;
      currentPos += 2; // 忽略 'Esc[', 因为每个序列都有它

      let ansiSequence = '';

      while (currentPos < textLength) {
        const char: string = text.charAt(currentPos);
        ansiSequence += char;

        currentPos++;

        // 序列终止字符
        if (char.match(/^[ABCDHIJKfhmpsu]$/)) {
          isSequenceFound = true;
          break;
        }
      }

      if (isSequenceFound) {
        appendStylizedStringToContainer(
          root,
          buffer,
          styleNames,
          linkDetector,
          workspaceFolder,
          customFgColor,
          customBgColor,
          customUnderlineColor,
        );

        buffer = '';

        if (
          ansiSequence.match(
            /^(?:[34][0-8]|9[0-7]|10[0-7]|[0-9]|2[1-5,7-9]|[34]9|5[8,9]|1[0-9])(?:;[349][0-7]|10[0-7]|[013]|[245]|[34]9)?(?:;[012]?[0-9]?[0-9])*;?m$/,
          )
        ) {
          /**
           * 例如: '\033[41m' + 'code' + '\033[0;39m'
           * 表示 'code' 这个字符串是红色的
           */
          const styleCodes: number[] = ansiSequence
            .slice(0, -1) // 删除最后的 'm' 字符
            .split(';') // 分隔 ';'
            .filter((elem) => elem !== '') // 过滤空元素: [39:m] => ['39', '']
            .map((elem) => parseInt(elem, 10));

          if (styleCodes[0] === 38 || styleCodes[0] === 48 || styleCodes[0] === 58) {
            /**
             * 代表 xterm-256 高级颜色
             * 38 表示前景色
             * 48 表示背景色
             * * @see {@link https://tintin.mudhalla.net/info/xterm/ }
             */
            const colorType = styleCodes[0] === 38 ? 'foreground' : styleCodes[0] === 48 ? 'background' : 'underline';

            if (styleCodes[1] === 5) {
              // 8位色
              await set8BitColor(styleCodes, colorType);
            } else if (styleCodes[1] === 2) {
              // 24位色
              set24BitColor(styleCodes, colorType);
            }
          } else {
            await setBasicFormatters(styleCodes);
          }
        }
      } else {
        currentPos = startPos;
      }
    }

    if (isSequenceFound === false) {
      buffer += text.charAt(currentPos);
      currentPos++;
    }
  }

  if (buffer) {
    appendStylizedStringToContainer(
      root,
      buffer,
      styleNames,
      linkDetector,
      workspaceFolder,
      customFgColor,
      customBgColor,
      customUnderlineColor,
    );
  }

  return root;

  /**
   * 修改前景色、背景色和下划线颜色
   */
  function changeColor(colorType: 'foreground' | 'background' | 'underline', color?: RGBA | undefined): void {
    switch (colorType) {
      case 'foreground':
        customFgColor = color;
        break;
      case 'background':
        customBgColor = color;
        break;
      case 'underline':
        customUnderlineColor = color;
        break;
      default:
        break;
    }

    styleNames = styleNames.filter((style) => style !== `code-${colorType}-colored`);
    if (color !== undefined) {
      styleNames.push(`code-${colorType}-colored`);
    }
  }

  /**
   * 转换前景色和背景色
   */
  function reverseForegroundAndBackgroundColors(): void {
    let oldFgColor: RGBA | undefined;
    oldFgColor = customFgColor;
    changeColor('foreground', customBgColor);
    changeColor('background', oldFgColor);
  }

  /**
   * 计算并设置 ANSI 基本样式.
   * 支持的样式看下面的文档👇
   * @see {@link https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97#%E9%80%89%E6%8B%A9%E5%9B%BE%E5%BD%A2%E5%86%8D%E7%8E%B0%EF%BC%88SGR%EF%BC%89%E5%8F%82%E6%95%B0 }
   */
  async function setBasicFormatters(styleCodes: number[]): Promise<void> {
    for (const code of styleCodes) {
      switch (code) {
        case 0: {
          // 重置
          styleNames = [];
          customFgColor = undefined;
          customBgColor = undefined;
          break;
        }
        case 1: {
          // 变粗
          styleNames = styleNames.filter((style) => style !== styles['code-bold']);
          styleNames.push(styles['code-bold']);
          break;
        }
        case 2: {
          // 降低透明度
          styleNames = styleNames.filter((style) => style !== styles['code-dim']);
          styleNames.push(styles['code-dim']);
          break;
        }
        case 3: {
          // 斜体
          styleNames = styleNames.filter((style) => style !== styles['code-italic']);
          styleNames.push(styles['code-italic']);
          break;
        }
        case 4: {
          // 下划线
          styleNames = styleNames.filter(
            (style) => style !== styles['code-underline'] && style !== styles['code-double-underline'],
          );
          styleNames.push(styles['code-underline']);
          break;
        }
        case 5: {
          // 缓慢闪烁
          styleNames = styleNames.filter((style) => style !== styles['code-blink']);
          styleNames.push(styles['code-blink']);
          break;
        }
        case 6: {
          // 快速闪烁
          styleNames = styleNames.filter((style) => style !== styles['code-rapid-blink']);
          styleNames.push(styles['code-rapid-blink']);
          break;
        }
        case 7: {
          // 前景色和背景色交换
          if (!colorsInverted) {
            colorsInverted = true;
            reverseForegroundAndBackgroundColors();
          }
          break;
        }
        case 8: {
          // 隐藏
          styleNames = styleNames.filter((style) => style !== styles['code-hidden']);
          styleNames.push(styles['code-hidden']);
          break;
        }
        case 9: {
          // 划除，在字符中间增加横线
          styleNames = styleNames.filter((style) => style !== styles['code-strike-through']);
          styleNames.push(styles['code-strike-through']);
          break;
        }
        case 10: {
          // 默认字体
          styleNames = styleNames.filter((style) => !style.startsWith(styles['code-font']));
          break;
        }
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20: {
          // 字体代码
          styleNames = styleNames.filter((style) => !style.startsWith(styles['code-font']));
          styleNames.push(styles[`code-font-${code - 10}`]);
          break;
        }
        case 21: {
          // 双下划线
          styleNames = styleNames.filter(
            (style) => style !== styles['code-underline'] && style !== styles['code-double-underline'],
          );
          styleNames.push(styles['code-double-underline']);
          break;
        }
        case 22: {
          // 正常强度的字体（不强不弱）
          styleNames = styleNames.filter((style) => style !== styles['code-bold'] && style !== styles['code-dim']);
          break;
        }
        case 23: {
          // 既不是斜体也不是黑体（字体 10）
          styleNames = styleNames.filter(
            (style) => style !== styles['code-italic'] && style !== styles['code-font-10'],
          );
          break;
        }
        case 24: {
          // 去除下划线
          styleNames = styleNames.filter(
            (style) => style !== styles['code-underline'] && style !== styles['code-double-underline'],
          );
          break;
        }
        case 25: {
          // 关闭闪烁
          styleNames = styleNames.filter(
            (style) => style !== styles['code-blink'] && style !== styles['code-rapid-blink'],
          );
          break;
        }
        case 27: {
          // 关闭前景色和背景色反转
          if (colorsInverted) {
            colorsInverted = false;
            reverseForegroundAndBackgroundColors();
          }
          break;
        }
        case 28: {
          // 不隐藏
          styleNames = styleNames.filter((style) => style !== styles['code-hidden']);
          break;
        }
        case 29: {
          // 关闭划除
          styleNames = styleNames.filter((style) => style !== styles['code-strike-through']);
          break;
        }
        case 53: {
          // 上划线
          styleNames = styleNames.filter((style) => style !== styles['code-overline']);
          styleNames.push(styles['code-overline']);
          break;
        }
        case 55: {
          // 关闭上划线
          styleNames = styleNames.filter((style) => style !== styles['code-overline']);
          break;
        }
        case 39: {
          // 默认前景色
          changeColor('foreground', undefined);
          break;
        }
        case 49: {
          // 默认背景色
          changeColor('background', undefined);
          break;
        }
        case 59: {
          // 默认下划线
          changeColor('underline', undefined);
          break;
        }
        case 73: {
          // 上标（向上靠）
          styleNames = styleNames.filter(
            (style) => style !== styles['code-superscript'] && style !== styles['code-subscript'],
          );
          styleNames.push(styles['code-superscript']);
          break;
        }
        case 74: {
          // 下标（向下靠）
          styleNames = styleNames.filter(
            (style) => style !== styles['code-superscript'] && style !== styles['code-subscript'],
          );
          styleNames.push(styles['code-subscript']);
          break;
        }
        case 75: {
          styleNames = styleNames.filter(
            (style) => style !== styles['code-superscript'] && style !== styles['code-subscript'],
          );
          break;
        }
        default: {
          await setBasicColor(code);
          break;
        }
      }
    }
  }

  /**
   * 计算和设置 24 位 ANSI 颜色代码的样式。
   * @see {@link https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97#24%E4%BD%8D }
   */
  function set24BitColor(styleCodes: number[], colorType: 'foreground' | 'background' | 'underline'): void {
    if (
      styleCodes.length >= 5 &&
      styleCodes[2] >= 0 &&
      styleCodes[2] <= 255 &&
      styleCodes[3] >= 0 &&
      styleCodes[3] <= 255 &&
      styleCodes[4] >= 0 &&
      styleCodes[4] <= 255
    ) {
      const customColor = new RGBA(styleCodes[2], styleCodes[3], styleCodes[4]);
      changeColor(colorType, customColor);
    }
  }

  /**
   * 计算和设置 8 位 ANSI 颜色代码的样式。
   * @see {@link https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97#8%E4%BD%8D }
   */
  async function set8BitColor(
    styleCodes: number[],
    colorType: 'foreground' | 'background' | 'underline',
  ): Promise<void> {
    let colorNumber = styleCodes[2];
    const color = calcANSI8bitColor(colorNumber);

    if (color) {
      changeColor(colorType, color);
    } else if (colorNumber >= 0 && colorNumber <= 15) {
      if (colorType === 'underline') {
        // 对于下划线颜色，我们只需将 0-15 颜色编号解码为主题颜色，设置并返回
        const theme = await themeService.getCurrentTheme();
        const colorName = ansiColorIdentifiers[colorNumber];
        const color = theme.getColor(colorName);
        if (color) {
          changeColor(colorType, color.rgba);
        }
        return;
      }
      // 映射到四种基本色的范围之一（30-37、90-97、40-47、100-107）
      colorNumber += 30;
      if (colorNumber >= 38) {
        // 亮色
        colorNumber += 52;
      }
      if (colorType === 'background') {
        colorNumber += 10;
      }
      await setBasicColor(colorNumber);
    }
  }

  /**
   * 计算和设置基本明亮和暗色 ANSI 颜色代码的样式
   */
  async function setBasicColor(styleCode: number): Promise<void> {
    const theme = await themeService.getCurrentTheme();
    let colorType: 'foreground' | 'background' | undefined;
    let colorIndex: number | undefined;

    if (styleCode >= 30 && styleCode <= 37) {
      colorIndex = styleCode - 30;
      colorType = 'foreground';
    } else if (styleCode >= 90 && styleCode <= 97) {
      colorIndex = styleCode - 90 + 8; // 亮色
      colorType = 'foreground';
    } else if (styleCode >= 40 && styleCode <= 47) {
      colorIndex = styleCode - 40;
      colorType = 'background';
    } else if (styleCode >= 100 && styleCode <= 107) {
      colorIndex = styleCode - 100 + 8; // 亮色
      colorType = 'background';
    }

    if (colorIndex !== undefined && colorType) {
      const colorName = ansiColorIdentifiers[colorIndex];
      const color = theme.getColor(colorName);
      if (color) {
        changeColor(colorType, color.rgba);
      }
    }
  }
}

export function appendStylizedStringToContainer(
  root: HTMLElement,
  stringContent: string,
  cssClasses: string[],
  linkDetector: LinkDetector,
  workspaceFolder: IWorkspaceFolder | undefined,
  customTextColor?: RGBA,
  customBackgroundColor?: RGBA,
  customUnderlineColor?: RGBA,
): void {
  if (!root || !stringContent) {
    return;
  }

  const container = linkDetector.linkify(stringContent, true, workspaceFolder);

  container.className = cssClasses.join(' ');
  if (customTextColor) {
    container.style.color = Color.Format.CSS.formatRGB(new Color(customTextColor));
  }
  if (customBackgroundColor) {
    container.style.backgroundColor = Color.Format.CSS.formatRGB(new Color(customBackgroundColor));
  }
  if (customUnderlineColor) {
    container.style.textDecorationColor = Color.Format.CSS.formatRGB(new Color(customUnderlineColor));
  }
  root.appendChild(container);
}

/**
 * 根据 ANSI 8 位标准中定义的颜色集计算颜色。
 * @see {@link https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97#8%E4%BD%8D }
 */
export function calcANSI8bitColor(colorNumber: number): RGBA | undefined {
  if (colorNumber % 1 !== 0) {
    return;
  }
  if (colorNumber >= 16 && colorNumber <= 231) {
    // 转换为 216 种 RGB 颜色之一
    colorNumber -= 16;

    let blue: number = colorNumber % 6;
    colorNumber = (colorNumber - blue) / 6;
    let green: number = colorNumber % 6;
    colorNumber = (colorNumber - green) / 6;
    let red: number = colorNumber;

    // 将三原色从 [0, 5] 映射为 [0, 255]
    const convFactor: number = 255 / 5;
    blue = Math.round(blue * convFactor);
    green = Math.round(green * convFactor);
    red = Math.round(red * convFactor);

    return new RGBA(red, green, blue);
  } else if (colorNumber >= 232 && colorNumber <= 255) {
    // 转换为灰色值
    colorNumber -= 232;
    const colorLevel: number = Math.round((colorNumber / 23) * 255);
    return new RGBA(colorLevel, colorLevel, colorLevel);
  } else {
    return;
  }
}
