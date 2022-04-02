/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isLinux, isWindows } from '@opensumi/ide-utils';

// https://github.com/microsoft/node-native-keymap/blob/master/index.d.ts

export interface IWindowsKeyboardMapping {
  [code: string]: IWindowsKeyMapping;
}

export interface IWindowsKeyMapping {
  vkey: string;
  value: string;
  withShift: string;
  withAltGr: string;
  withShiftAltGr: string;
}

export interface IWindowsKeyboardLayoutInfo {
  name: string;
  id: string;
  text: string;
}

export interface ILinuxKeyboardLayoutInfo {
  model: string;
  layout: string;
  variant: string;
  options: string;
  rules: string;
}

export interface IMacKeyboardLayoutInfo {
  id: string;
  localizedName?: string;
  lang: string;
}

export interface IWindowsKeyboardLayoutInfo {
  name: string;
  id: string;
  text: string;
}

export type IKeyboardLayoutInfo = (IWindowsKeyboardLayoutInfo | ILinuxKeyboardLayoutInfo | IMacKeyboardLayoutInfo) & {
  isUserKeyboardLayout?: boolean;
  isUSStandard?: true;
};

export interface ISerializedMapping {
  [key: string]: (string | number)[];
}

export interface IKeymapInfo {
  layout: IKeyboardLayoutInfo;
  secondaryLayouts: IKeyboardLayoutInfo[];
  mapping: ISerializedMapping;
  isUserKeyboardLayout?: boolean;
}

export interface IRawMixedKeyboardMapping {
  [key: string]: {
    value: string;
    withShift: string;
    withAltGr: string;
    withShiftAltGr: string;
    valueIsDeadKey?: boolean;
    withShiftIsDeadKey?: boolean;
    withAltGrIsDeadKey?: boolean;
    withShiftAltGrIsDeadKey?: boolean;
  };
}

function deserializeMapping(serializedMapping: ISerializedMapping) {
  const mapping = serializedMapping;

  const ret: { [key: string]: any } = {};
  // eslint-disable-next-line guard-for-in
  for (const key in mapping) {
    const result: (string | number)[] = mapping[key];
    if (result.length) {
      const value = result[0];
      const withShift = result[1];
      const withAltGr = result[2];
      const withShiftAltGr = result[3];
      const mask = Number(result[4]);
      const vkey = result.length === 6 ? result[5] : undefined;
      ret[key] = {
        value,
        vkey,
        withShift,
        withAltGr,
        withShiftAltGr,
        valueIsDeadKey: (mask & 1) > 0,
        withShiftIsDeadKey: (mask & 2) > 0,
        withAltGrIsDeadKey: (mask & 4) > 0,
        withShiftAltGrIsDeadKey: (mask & 8) > 0,
      };
    } else {
      ret[key] = {
        value: '',
        valueIsDeadKey: false,
        withShift: '',
        withShiftIsDeadKey: false,
        withAltGr: '',
        withAltGrIsDeadKey: false,
        withShiftAltGr: '',
        withShiftAltGrIsDeadKey: false,
      };
    }
  }

  return ret;
}

export function getKeyboardLayoutId(layout: IKeyboardLayoutInfo): string {
  if ((layout as IWindowsKeyboardLayoutInfo).name) {
    return (layout as IWindowsKeyboardLayoutInfo).name;
  }

  if ((layout as IMacKeyboardLayoutInfo).id) {
    return (layout as IMacKeyboardLayoutInfo).id;
  }
  return (layout as ILinuxKeyboardLayoutInfo).layout;
}

export class KeymapInfo {
  mapping: IRawMixedKeyboardMapping;
  isUserKeyboardLayout: boolean;

  constructor(
    public layout: IKeyboardLayoutInfo,
    public secondaryLayouts: IKeyboardLayoutInfo[],
    keyboardMapping: ISerializedMapping,
    isUserKeyboardLayout?: boolean,
  ) {
    this.mapping = deserializeMapping(keyboardMapping);
    this.isUserKeyboardLayout = !!isUserKeyboardLayout;
    this.layout.isUserKeyboardLayout = !!isUserKeyboardLayout;
  }

  static createKeyboardLayoutFromDebugInfo(
    layout: IKeyboardLayoutInfo,
    value: IRawMixedKeyboardMapping,
    isUserKeyboardLayout?: boolean,
  ): KeymapInfo {
    const keyboardLayoutInfo = new KeymapInfo(layout, [], {}, true);
    keyboardLayoutInfo.mapping = value;
    return keyboardLayoutInfo;
  }

  update(other: KeymapInfo) {
    this.layout = other.layout;
    this.secondaryLayouts = other.secondaryLayouts;
    this.mapping = other.mapping;
    this.isUserKeyboardLayout = other.isUserKeyboardLayout;
    this.layout.isUserKeyboardLayout = other.isUserKeyboardLayout;
  }

  getScore(other: IRawMixedKeyboardMapping): number {
    let score = 0;
    for (const key in other) {
      if (isWindows && (key === 'Backslash' || key === 'KeyQ')) {
        // keymap from Chromium is probably wrong.
        continue;
      }

      if (isLinux && (key === 'Backspace' || key === 'Escape')) {
        // native keymap doesn't align with keyboard event
        continue;
      }

      const currentMapping = this.mapping[key];

      if (currentMapping === undefined) {
        score -= 1;
      }

      const otherMapping = other[key];

      if (currentMapping && otherMapping && currentMapping.value !== otherMapping.value) {
        score -= 1;
      }
    }

    return score;
  }

  equal(other: KeymapInfo): boolean {
    if (this.isUserKeyboardLayout !== other.isUserKeyboardLayout) {
      return false;
    }

    if (getKeyboardLayoutId(this.layout) !== getKeyboardLayoutId(other.layout)) {
      return false;
    }

    return this.fuzzyEqual(other.mapping);
  }

  fuzzyEqual(other: IRawMixedKeyboardMapping): boolean {
    for (const key in other) {
      if (isWindows && (key === 'Backslash' || key === 'KeyQ')) {
        // keymap from Chromium is probably wrong.
        continue;
      }
      if (this.mapping[key] === undefined) {
        return false;
      }

      const currentMapping = this.mapping[key];
      const otherMapping = other[key];

      if (currentMapping.value !== otherMapping.value) {
        return false;
      }
    }

    return true;
  }
}
