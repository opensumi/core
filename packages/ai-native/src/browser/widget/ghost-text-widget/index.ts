/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/inlineCompletions/browser/ghostTextWidget.ts#L271

import { createTrustedTypesPolicy } from '@opensumi/monaco-editor-core/esm/vs/base/browser/trustedTypes';
import * as strings from '@opensumi/monaco-editor-core/esm/vs/base/common/strings';
import { applyFontInfo } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/config/domFontInfo';
import {
  EditorFontLigatures,
  EditorOption,
  IComputedEditorOptions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { StringBuilder } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/stringBuilder';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { LineDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/viewLayout/lineDecorations';
import {
  RenderLineInput,
  renderViewLine,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/viewLayout/viewLineRenderer';

export interface LineData {
  content: string;
  decorations: LineDecoration[];
  lineTokens: LineTokens;
}

/**
 * 这里复用 monaco 的 ghostTextWidget 逻辑，需要对其做部分逻辑修改
 * 目的是为了能让 zone widget 里渲染的代码块能使用 tokenization 以达到高亮效果
 */
export const renderLines = (
  domNode: HTMLElement,
  tabSize: number,
  lines: LineData[],
  opts: IComputedEditorOptions,
): void => {
  const disableMonospaceOptimizations = opts.get(EditorOption.disableMonospaceOptimizations);
  const stopRenderingLineAfter = opts.get(EditorOption.stopRenderingLineAfter);
  const renderWhitespace = 'none';
  const renderControlCharacters = opts.get(EditorOption.renderControlCharacters);
  const fontLigatures = opts.get(EditorOption.fontLigatures);
  const fontInfo = opts.get(EditorOption.fontInfo);
  const lineHeight = opts.get(EditorOption.lineHeight);

  const sb = new StringBuilder(10000);
  sb.appendString('<div class="suggest-preview-text">');

  for (let i = 0, len = lines.length; i < len; i++) {
    const lineData = lines[i];
    const line = lineData.content;
    sb.appendString('<div class="view-line');
    sb.appendString('" style="top:');
    sb.appendString(String(i * lineHeight));
    sb.appendString('px;width:1000000px;">');

    const isBasicASCII = strings.isBasicASCII(line);
    const containsRTL = strings.containsRTL(line);

    renderViewLine(
      new RenderLineInput(
        fontInfo.isMonospace && !disableMonospaceOptimizations,
        fontInfo.canUseHalfwidthRightwardsArrow,
        line,
        false,
        isBasicASCII,
        containsRTL,
        0,
        lineData.lineTokens,
        lineData.decorations,
        tabSize,
        0,
        fontInfo.spaceWidth,
        fontInfo.middotWidth,
        fontInfo.wsmiddotWidth,
        stopRenderingLineAfter,
        renderWhitespace,
        renderControlCharacters,
        fontLigatures !== EditorFontLigatures.OFF,
        null,
      ),
      sb,
    );

    sb.appendString('</div>');
  }
  sb.appendString('</div>');

  applyFontInfo(domNode, fontInfo);
  const html = sb.build();
  const trustedhtml = ttPolicy ? ttPolicy.createHTML(html) : html;
  domNode.innerHTML = trustedhtml as string;
};

export const ttPolicy = createTrustedTypesPolicy('editorGhostText', { createHTML: (value) => value });
