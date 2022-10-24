/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useRef } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, ConfigProvider, useInjectable } from '@opensumi/ide-core-browser';
import { formatLocalize, localize } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ZoneWidget } from '@opensumi/ide-monaco-enhance';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IDebugExceptionInfo } from '../common';

import { LinkDetector } from './debug-link-detector';

import './components/debug-exception-widget.less';

function ExceptionInfoContainer({ info, layout }: { info: IDebugExceptionInfo; layout: () => void }) {
  const linkDetector = useInjectable<LinkDetector>(LinkDetector);
  const stackTraceRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (stackTraceRef.current) {
      stackTraceRef.current.appendChild(linkDetector.linkify(info.details?.stackTrace || '', true));
    }
    layout();
  }, [info.details, info.details?.stackTrace, stackTraceRef]);

  return (
    <div className={'exception_widget'}>
      <div className={'title'}>
        <div className={'label'}>
          {info.id
            ? formatLocalize('debug.widget.exception.thrownWithId', info.id)
            : localize('debug.widget.exception.thrown')}
        </div>
      </div>
      {info.description ? <div className={'description'}>{info.description}</div> : null}
      {info.details && info.details.stackTrace ? <div className={'stack_trace'} ref={stackTraceRef}></div> : null}
    </div>
  );
}

@Injectable({ multiple: true })
export class DebugExceptionWidget extends ZoneWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  constructor(editor: ICodeEditor, private exceptionInfo: IDebugExceptionInfo) {
    super(editor);

    this.create();
  }

  protected applyClass(): void {}

  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('exception_widget_container');
    const fontInfo = this.editor.getOption(EditorOption.fontInfo);
    container.style.fontSize = `${fontInfo.fontSize}px`;
    container.style.lineHeight = `${fontInfo.lineHeight}px`;
    container.tabIndex = 0;

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <ExceptionInfoContainer
          info={this.exceptionInfo}
          layout={() => this.layout(undefined)}
        ></ExceptionInfoContainer>
      </ConfigProvider>,
      container,
    );
  }

  public layout(_info: monaco.editor.EditorLayoutInfo | undefined): void {
    this._container!.style.height = 'initial';
    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    const arrowHeight = Math.round(lineHeight / 3);
    const computedLinesNumber = Math.ceil((this._container!.offsetHeight + arrowHeight) / lineHeight);

    this._relayout(computedLinesNumber);
  }

  public focus(): void {
    this._container.focus();
  }
}
