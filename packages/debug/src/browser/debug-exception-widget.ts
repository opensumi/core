/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ZoneWidget } from '@opensumi/ide-monaco-enhance';
import { Color } from '@opensumi/ide-theme';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IDebugExceptionInfo, IDebugSession } from '../common';

// export const debugExceptionWidgetBorder = registerColor('debugExceptionWidget.border', { dark: '#a31515', light: '#a31515', hcDark: '#a31515', hcLight: '#a31515' }, nls.localize('debugExceptionWidgetBorder', 'Exception widget border color.'));
// export const debugExceptionWidgetBackground = registerColor('debugExceptionWidget.background', { dark: '#420b0d', light: '#f1dfde', hcDark: '#420b0d', hcLight: '#f1dfde' }, nls.localize('debugExceptionWidgetBackground', 'Exception widget background color.'));

export class DebugExceptionWidget extends ZoneWidget {
  protected applyClass(): void {
    throw new Error('Method not implemented.');
  }

  private backgroundColor: Color | undefined;

  constructor(
    editor: ICodeEditor,
    private exceptionInfo: IDebugExceptionInfo,
    private debugSession: IDebugSession | undefined,
  ) {
    super(editor);

    this.create();
    const onDidLayoutChangeScheduler = new RunOnceScheduler(() => this.layout(undefined), 50);
    this.addDispose(onDidLayoutChangeScheduler);
  }

  protected applyStyle(): void {
    if (this._container) {
      this._container.style.backgroundColor = this.backgroundColor ? this.backgroundColor.toString() : '';
    }
  }

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('exception-widget');
    const fontInfo = this.editor.getOption(EditorOption.fontInfo);
    container.style.fontSize = `${fontInfo.fontSize}px`;
    container.style.lineHeight = `${fontInfo.lineHeight}px`;
    container.tabIndex = 0;

    if (this.exceptionInfo.description) {
    }

    if (this.exceptionInfo.details && this.exceptionInfo.details.stackTrace) {
    }
  }

  public layout(_info: monaco.editor.EditorLayoutInfo | undefined): void {
    this._container!.style.height = 'initial';

    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    const arrowHeight = Math.round(lineHeight / 3);
    const computedLinesNumber = Math.ceil((this._container!.offsetHeight + arrowHeight) / lineHeight);

    this._relayout(computedLinesNumber);
  }
}
