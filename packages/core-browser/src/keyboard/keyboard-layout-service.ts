/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/core/src/browser/keyboard/keyboard-layout-service.ts

import { Injectable, Autowired } from '@opensumi/di';
import { isWindows, Emitter, Event } from '@opensumi/ide-core-common';
import {
  KeyboardNativeLayoutService,
  KeyboardLayoutChangeNotifierService,
  KeymapInfo,
  IWindowsKeyMapping,
} from '@opensumi/ide-core-common/lib/keyboard';

import { KeyValidator } from './keyboard-layout-provider';
import { KeyCode, Key } from './keys';

export interface KeyboardLayout {
  /**
   * 映射美国标准键盘值到实际的KeyCode
   * 对应KeyboardLayoutService.getCharacterIndex中使用
   */
  readonly key2KeyCode: KeyCode[];
  /**
   * 映射键盘事件键值到用户可视化的字符
   */
  readonly code2Character: { [code: string]: string };
}

@Injectable()
export class KeyboardLayoutService {
  @Autowired(KeyboardNativeLayoutService)
  protected readonly layoutProvider: KeyboardNativeLayoutService;

  @Autowired(KeyboardLayoutChangeNotifierService)
  protected readonly layoutChangeNotifier: KeyboardLayoutChangeNotifierService;

  @Autowired(KeyValidator)
  protected readonly keyValidator: KeyValidator;

  private currentLayout?: KeyboardLayout;

  protected updateLayout(newLayout: KeymapInfo): KeyboardLayout {
    const transformed = this.transformNativeLayout(newLayout);
    this.currentLayout = transformed;
    this.keyboardLayoutChanged.fire(transformed);
    return transformed;
  }

  protected keyboardLayoutChanged = new Emitter<KeyboardLayout>();

  get onKeyboardLayoutChanged(): Event<KeyboardLayout> {
    return this.keyboardLayoutChanged.event;
  }

  public async initialize(): Promise<void> {
    this.layoutChangeNotifier.onDidChangeNativeLayout((newLayout) => this.updateLayout(newLayout));
    const initialLayout = await this.layoutProvider.getNativeLayout();
    if (initialLayout) {
      this.updateLayout(initialLayout);
    }
  }

  /**
   * 使用当前的键盘布局信息解析快捷键 KeyCode
   * 如果当前没有监测到布局信息或当前布局信息不包含当前 KeyCode，直接返回入参的 KeycCode
   * @param inCode
   */
  public resolveKeyCode(inCode: KeyCode): KeyCode {
    const layout = this.currentLayout;
    if (layout && inCode.key) {
      for (let shift = 0; shift <= 1; shift++) {
        const index = this.getCharacterIndex(inCode.key, !!shift);
        const mappedCode = layout.key2KeyCode[index];
        if (mappedCode) {
          const transformed = this.transformKeyCode(inCode, mappedCode, !!shift);
          if (transformed) {
            return transformed;
          }
        }
      }
    }
    return inCode;
  }

  /**
   * 根据键盘键值返回对应字符串，主要用于UI展示
   * 如 shift 展示为 ⇧
   */
  public getKeyboardCharacter(key: Key): string {
    const layout = this.currentLayout;
    if (layout) {
      const value = layout.code2Character[key.code];
      if (value) {
        return value;
      }
    }
    return key.easyString;
  }

  /**
   * 当 KeybindingRegistry 处理 KeyboardEvent 时调用。
   * 用于对制定了 autodetect 模式下的键盘布局逻辑进行布局信息判断
   */
  public validateKeyCode(keyCode: KeyCode): void {
    this.keyValidator.validateKeyCode(keyCode);
  }

  protected transformKeyCode(inCode: KeyCode, mappedCode: KeyCode, keyNeedsShift: boolean): KeyCode | undefined {
    if (!inCode.shift && keyNeedsShift) {
      return undefined;
    }
    if (mappedCode.alt && (inCode.alt || inCode.ctrl || (inCode.shift && !keyNeedsShift))) {
      return undefined;
    }
    return new KeyCode({
      key: mappedCode.key,
      meta: inCode.meta,
      ctrl: inCode.ctrl || mappedCode.alt,
      shift: (inCode.shift && !keyNeedsShift) || mappedCode.shift,
      alt: inCode.alt || mappedCode.alt,
    });
  }

  protected transformNativeLayout(nativeLayout: KeymapInfo): KeyboardLayout {
    const key2KeyCode: KeyCode[] = new Array(2 * (Key.MAX_KEY_CODE + 1));
    const code2Character: { [code: string]: string } = {};
    const mapping = nativeLayout.mapping;
    for (const code in mapping) {
      if (mapping.hasOwnProperty(code)) {
        const keyMapping = mapping[code];
        const mappedKey = Key.getKey(code);
        if (mappedKey && this.shouldIncludeKey(code)) {
          if (isWindows) {
            this.addWindowsKeyMapping(
              key2KeyCode,
              mappedKey,
              (keyMapping as IWindowsKeyMapping).vkey,
              keyMapping.value,
            );
          } else {
            if (keyMapping.value) {
              this.addKeyMapping(key2KeyCode, mappedKey, keyMapping.value, false, false);
            }
            if (keyMapping.withShift) {
              this.addKeyMapping(key2KeyCode, mappedKey, keyMapping.withShift, true, false);
            }
            if (keyMapping.withAltGr) {
              this.addKeyMapping(key2KeyCode, mappedKey, keyMapping.withAltGr, false, true);
            }
            if (keyMapping.withShiftAltGr) {
              this.addKeyMapping(key2KeyCode, mappedKey, keyMapping.withShiftAltGr, true, true);
            }
          }
        }
        if (keyMapping.value) {
          code2Character[code] = keyMapping.value;
        }
      }
    }
    return { key2KeyCode, code2Character };
  }

  private shouldIncludeKey(code: string): boolean {
    /**
     * FIXME: 这里没有很好的考虑到 `NumLock` 影响下的交互
     * 如果 `NumLock` 为关闭状态，部分用户在 Windows 下的一些交互可能存在疑惑
     * 如，`Numpad3` 本身在 `NumLock` 关闭状态下指向 `PageDown`
     * 当在此处的逻辑处理下，`Numpad3` 只会被处理为 `Key.DIGIT3`
     * 该行为在 Mac 下无影响，因为 Mac 会把所有小键盘按键均作为输出值使用
     * 参考：https://github.com/microsoft/vscode/blob/436725c584e4422e6764a3c19970f7d1d7f6971c/src/vs/workbench/services/keybinding/browser/keybindingService.ts#L622
     */
    return !code.startsWith('Numpad');
  }

  private addKeyMapping(key2KeyCode: KeyCode[], mappedKey: Key, value: string, shift: boolean, alt: boolean): void {
    const key = VALUE_TO_KEY[value];
    if (key) {
      const index = this.getCharacterIndex(key.key, key.shift);
      if (key2KeyCode[index] === undefined) {
        key2KeyCode[index] = new KeyCode({
          key: mappedKey,
          shift,
          alt,
          character: value,
        });
      }
    }
  }

  private addWindowsKeyMapping(key2KeyCode: KeyCode[], mappedKey: Key, vkey: string, value: string) {
    const key = VKEY_TO_KEY[vkey];
    if (key) {
      const index = this.getCharacterIndex(key);
      if (key2KeyCode[index] === undefined) {
        key2KeyCode[index] = new KeyCode({
          key: mappedKey,
          character: value,
        });
      }
    }
  }

  protected getCharacterIndex(key: Key, shift?: boolean): number {
    if (shift) {
      return Key.MAX_KEY_CODE + key.keyCode + 1;
    } else {
      return key.keyCode;
    }
  }
}

/**
 * 字符值与标准美国键盘布局上的相应键的映射关系。
 */
const VALUE_TO_KEY: { [value: string]: { key: Key; shift?: boolean } } = {
  '`': { key: Key.BACKQUOTE },
  '~': { key: Key.BACKQUOTE, shift: true },
  '1': { key: Key.DIGIT1 },
  '!': { key: Key.DIGIT1, shift: true },
  '2': { key: Key.DIGIT2 },
  '@': { key: Key.DIGIT2, shift: true },
  '3': { key: Key.DIGIT3 },
  '#': { key: Key.DIGIT3, shift: true },
  '4': { key: Key.DIGIT4 },
  $: { key: Key.DIGIT4, shift: true },
  '5': { key: Key.DIGIT5 },
  '%': { key: Key.DIGIT5, shift: true },
  '6': { key: Key.DIGIT6 },
  '^': { key: Key.DIGIT6, shift: true },
  '7': { key: Key.DIGIT7 },
  '&': { key: Key.DIGIT7, shift: true },
  '8': { key: Key.DIGIT8 },
  '*': { key: Key.DIGIT8, shift: true },
  '9': { key: Key.DIGIT9 },
  '(': { key: Key.DIGIT9, shift: true },
  '0': { key: Key.DIGIT0 },
  ')': { key: Key.DIGIT0, shift: true },
  '-': { key: Key.MINUS },
  _: { key: Key.MINUS, shift: true },
  '=': { key: Key.EQUAL },
  '+': { key: Key.EQUAL, shift: true },

  a: { key: Key.KEY_A },
  A: { key: Key.KEY_A, shift: true },
  b: { key: Key.KEY_B },
  B: { key: Key.KEY_B, shift: true },
  c: { key: Key.KEY_C },
  C: { key: Key.KEY_C, shift: true },
  d: { key: Key.KEY_D },
  D: { key: Key.KEY_D, shift: true },
  e: { key: Key.KEY_E },
  E: { key: Key.KEY_E, shift: true },
  f: { key: Key.KEY_F },
  F: { key: Key.KEY_F, shift: true },
  g: { key: Key.KEY_G },
  G: { key: Key.KEY_G, shift: true },
  h: { key: Key.KEY_H },
  H: { key: Key.KEY_H, shift: true },
  i: { key: Key.KEY_I },
  I: { key: Key.KEY_I, shift: true },
  j: { key: Key.KEY_J },
  J: { key: Key.KEY_J, shift: true },
  k: { key: Key.KEY_K },
  K: { key: Key.KEY_K, shift: true },
  l: { key: Key.KEY_L },
  L: { key: Key.KEY_L, shift: true },
  m: { key: Key.KEY_M },
  M: { key: Key.KEY_M, shift: true },
  n: { key: Key.KEY_N },
  N: { key: Key.KEY_N, shift: true },
  o: { key: Key.KEY_O },
  O: { key: Key.KEY_O, shift: true },
  p: { key: Key.KEY_P },
  P: { key: Key.KEY_P, shift: true },
  q: { key: Key.KEY_Q },
  Q: { key: Key.KEY_Q, shift: true },
  r: { key: Key.KEY_R },
  R: { key: Key.KEY_R, shift: true },
  s: { key: Key.KEY_S },
  S: { key: Key.KEY_S, shift: true },
  t: { key: Key.KEY_T },
  T: { key: Key.KEY_T, shift: true },
  u: { key: Key.KEY_U },
  U: { key: Key.KEY_U, shift: true },
  v: { key: Key.KEY_V },
  V: { key: Key.KEY_V, shift: true },
  w: { key: Key.KEY_W },
  W: { key: Key.KEY_W, shift: true },
  x: { key: Key.KEY_X },
  X: { key: Key.KEY_X, shift: true },
  y: { key: Key.KEY_Y },
  Y: { key: Key.KEY_Y, shift: true },
  z: { key: Key.KEY_Z },
  Z: { key: Key.KEY_Z, shift: true },

  '[': { key: Key.BRACKET_LEFT },
  '{': { key: Key.BRACKET_LEFT, shift: true },
  ']': { key: Key.BRACKET_RIGHT },
  '}': { key: Key.BRACKET_RIGHT, shift: true },
  ';': { key: Key.SEMICOLON },
  ':': { key: Key.SEMICOLON, shift: true },
  "'": { key: Key.QUOTE },
  '"': { key: Key.QUOTE, shift: true },
  ',': { key: Key.COMMA },
  '<': { key: Key.COMMA, shift: true },
  '.': { key: Key.PERIOD },
  '>': { key: Key.PERIOD, shift: true },
  '/': { key: Key.SLASH },
  '?': { key: Key.SLASH, shift: true },
  '\\': { key: Key.BACKSLASH },
  '|': { key: Key.BACKSLASH, shift: true },

  '\t': { key: Key.TAB },
  '\r': { key: Key.ENTER },
  '\n': { key: Key.ENTER },
  ' ': { key: Key.SPACE },
};

/**
 * Windows虚拟键与标准美国键盘布局上的相应键的映射关系。
 */
const VKEY_TO_KEY: { [value: string]: Key } = {
  VK_SHIFT: Key.SHIFT_LEFT,
  VK_LSHIFT: Key.SHIFT_LEFT,
  VK_RSHIFT: Key.SHIFT_RIGHT,
  VK_CONTROL: Key.CONTROL_LEFT,
  VK_LCONTROL: Key.CONTROL_LEFT,
  VK_RCONTROL: Key.CONTROL_RIGHT,
  VK_MENU: Key.ALT_LEFT,
  VK_COMMAND: Key.OS_LEFT,
  VK_LWIN: Key.OS_LEFT,
  VK_RWIN: Key.OS_RIGHT,

  VK_0: Key.DIGIT0,
  VK_1: Key.DIGIT1,
  VK_2: Key.DIGIT2,
  VK_3: Key.DIGIT3,
  VK_4: Key.DIGIT4,
  VK_5: Key.DIGIT5,
  VK_6: Key.DIGIT6,
  VK_7: Key.DIGIT7,
  VK_8: Key.DIGIT8,
  VK_9: Key.DIGIT9,
  VK_A: Key.KEY_A,
  VK_B: Key.KEY_B,
  VK_C: Key.KEY_C,
  VK_D: Key.KEY_D,
  VK_E: Key.KEY_E,
  VK_F: Key.KEY_F,
  VK_G: Key.KEY_G,
  VK_H: Key.KEY_H,
  VK_I: Key.KEY_I,
  VK_J: Key.KEY_J,
  VK_K: Key.KEY_K,
  VK_L: Key.KEY_L,
  VK_M: Key.KEY_M,
  VK_N: Key.KEY_N,
  VK_O: Key.KEY_O,
  VK_P: Key.KEY_P,
  VK_Q: Key.KEY_Q,
  VK_R: Key.KEY_R,
  VK_S: Key.KEY_S,
  VK_T: Key.KEY_T,
  VK_U: Key.KEY_U,
  VK_V: Key.KEY_V,
  VK_W: Key.KEY_W,
  VK_X: Key.KEY_X,
  VK_Y: Key.KEY_Y,
  VK_Z: Key.KEY_Z,

  VK_OEM_1: Key.SEMICOLON,
  VK_OEM_2: Key.SLASH,
  VK_OEM_3: Key.BACKQUOTE,
  VK_OEM_4: Key.BRACKET_LEFT,
  VK_OEM_5: Key.BACKSLASH,
  VK_OEM_6: Key.BRACKET_RIGHT,
  VK_OEM_7: Key.QUOTE,
  VK_OEM_PLUS: Key.EQUAL,
  VK_OEM_COMMA: Key.COMMA,
  VK_OEM_MINUS: Key.MINUS,
  VK_OEM_PERIOD: Key.PERIOD,

  VK_F1: Key.F1,
  VK_F2: Key.F2,
  VK_F3: Key.F3,
  VK_F4: Key.F4,
  VK_F5: Key.F5,
  VK_F6: Key.F6,
  VK_F7: Key.F7,
  VK_F8: Key.F8,
  VK_F9: Key.F9,
  VK_F10: Key.F10,
  VK_F11: Key.F11,
  VK_F12: Key.F12,
  VK_F13: Key.F13,
  VK_F14: Key.F14,
  VK_F15: Key.F15,
  VK_F16: Key.F16,
  VK_F17: Key.F17,
  VK_F18: Key.F18,
  VK_F19: Key.F19,

  VK_BACK: Key.BACKSPACE,
  VK_TAB: Key.TAB,
  VK_RETURN: Key.ENTER,
  VK_CAPITAL: Key.CAPS_LOCK,
  VK_ESCAPE: Key.ESCAPE,
  VK_SPACE: Key.SPACE,
  VK_PRIOR: Key.PAGE_UP,
  VK_NEXT: Key.PAGE_DOWN,
  VK_END: Key.END,
  VK_HOME: Key.HOME,
  VK_INSERT: Key.INSERT,
  VK_DELETE: Key.DELETE,
  VK_LEFT: Key.ARROW_LEFT,
  VK_UP: Key.ARROW_UP,
  VK_RIGHT: Key.ARROW_RIGHT,
  VK_DOWN: Key.ARROW_DOWN,

  VK_NUMLOCK: Key.NUM_LOCK,
  VK_NUMPAD0: Key.DIGIT0,
  VK_NUMPAD1: Key.DIGIT1,
  VK_NUMPAD2: Key.DIGIT2,
  VK_NUMPAD3: Key.DIGIT3,
  VK_NUMPAD4: Key.DIGIT4,
  VK_NUMPAD5: Key.DIGIT5,
  VK_NUMPAD6: Key.DIGIT6,
  VK_NUMPAD7: Key.DIGIT7,
  VK_NUMPAD8: Key.DIGIT8,
  VK_NUMPAD9: Key.DIGIT9,
  VK_MULTIPLY: Key.NUMPAD_MULTIPLY,
  VK_ADD: Key.NUMPAD_ADD,
  VK_SUBTRACT: Key.NUMPAD_SUBTRACT,
  VK_DECIMAL: Key.NUMPAD_DECIMAL,
  VK_DIVIDE: Key.NUMPAD_DIVIDE,
};
