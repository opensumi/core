/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from '../common/color';
import { ITheme } from '../common/theme.service';

import {
  IColorRegistry,
  registerColor,
  getColorRegistry,
  transparent,
  darken,
  lighten,
  lessProminent,
  resolveColorValue,
} from './utils';

//  ------ API types

// color registry
export const Extensions = {
  ColorContribution: 'base.contributions.colors',
};

// < --- Workbench (not customizable) --- >

export function WORKBENCH_BACKGROUND(theme: ITheme): Color {
  switch (theme.type) {
    case 'dark':
      return Color.fromHex('#252526');
    case 'light':
      return Color.fromHex('#F3F3F3');
    default:
      return Color.fromHex('#000000');
  }
}

export {
  lighten,
  darken,
  transparent,
  lessProminent,
  resolveColorValue,
  IColorRegistry,
  registerColor,
  getColorRegistry,
};

// 导出所有的 color token
export * from './color-tokens';
