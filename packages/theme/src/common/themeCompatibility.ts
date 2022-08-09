/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from './color';
import * as colorRegistry from './color-registry';
// 导出所有的 color token
import * as colorTokens from './color-tokens';
import { ITokenColorizationRule, IColorMap } from './theme.service';

const settingToColorIdMapping: { [settingId: string]: string[] } = {};
function addSettingMapping(settingId: string, colorId: string) {
  let colorIds = settingToColorIdMapping[settingId];
  if (!colorIds) {
    settingToColorIdMapping[settingId] = colorIds = [];
  }
  colorIds.push(colorId);
}

// 旧的settings和新的ITokenColorizationRule的转换（主要是一些key的映射）
// tslint:disable
export function convertSettings(
  oldSettings: ITokenColorizationRule[],
  resultRules: ITokenColorizationRule[],
  resultColors: IColorMap,
): void {
  for (const rule of oldSettings) {
    resultRules.push(rule);
    if (!rule.scope) {
      const settings = rule.settings;
      if (!settings) {
        rule.settings = {};
      } else {
        // eslint-disable-next-line guard-for-in
        for (const key in settings) {
          const mappings = settingToColorIdMapping[key];
          if (mappings) {
            const colorHex = settings[key];
            if (typeof colorHex === 'string') {
              const color = Color.fromHex(colorHex);
              for (const colorId of mappings) {
                resultColors[colorId] = color;
              }
            }
          }
          if (key !== 'foreground' && key !== 'background' && key !== 'fontStyle') {
            delete settings[key];
          }
        }
      }
    }
  }
}

addSettingMapping('background', colorTokens.editorBackground);
addSettingMapping('foreground', colorTokens.editorForeground);
addSettingMapping('selection', colorTokens.editorSelectionBackground);
addSettingMapping('inactiveSelection', colorTokens.editorInactiveSelection);
addSettingMapping('selectionHighlightColor', colorTokens.editorSelectionHighlight);
addSettingMapping('findMatchHighlight', colorTokens.editorFindMatchHighlight);
addSettingMapping('currentFindMatchHighlight', colorTokens.editorFindMatch);
addSettingMapping('hoverHighlight', colorTokens.editorHoverHighlight);
addSettingMapping('wordHighlight', 'editor.wordHighlightBackground'); // inlined to avoid editor/contrib dependenies
addSettingMapping('wordHighlightStrong', 'editor.wordHighlightStrongBackground');
addSettingMapping('findRangeHighlight', colorTokens.editorFindRangeHighlight);
addSettingMapping('findMatchHighlight', 'peekViewResult.matchHighlightBackground');
addSettingMapping('referenceHighlight', 'peekViewEditor.matchHighlightBackground');
addSettingMapping('lineHighlight', colorTokens.editorLineHighlight);
addSettingMapping('rangeHighlight', colorTokens.editorRangeHighlight);
addSettingMapping('caret', colorTokens.editorCursorForeground);
addSettingMapping('invisibles', colorTokens.editorWhitespaces);
addSettingMapping('guide', colorTokens.editorIndentGuides);
addSettingMapping('activeGuide', colorTokens.editorActiveIndentGuides);

const ansiColorMap = [
  'ansiBlack',
  'ansiRed',
  'ansiGreen',
  'ansiYellow',
  'ansiBlue',
  'ansiMagenta',
  'ansiCyan',
  'ansiWhite',
  'ansiBrightBlack',
  'ansiBrightRed',
  'ansiBrightGreen',
  'ansiBrightYellow',
  'ansiBrightBlue',
  'ansiBrightMagenta',
  'ansiBrightCyan',
  'ansiBrightWhite',
];

for (const color of ansiColorMap) {
  addSettingMapping(color, 'terminal.' + color);
}
