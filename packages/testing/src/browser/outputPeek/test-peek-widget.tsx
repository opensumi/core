import React from 'react';
import ReactDOM from 'react-dom';
import { PeekViewWidget } from '@opensumi/ide-monaco-enhance/lib/browser/peek-view';
import { Injectable } from '@opensumi/di';
import type { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { TestDto } from './test-output-peek';
import { TestMessageType } from '../../common/testCollection';
import './test-peek-widget.less';

@Injectable({ multiple: true })
export class TestingOutputPeek extends PeekViewWidget {
  public current?: TestDto;
  private _wrapper: HTMLDivElement;

  constructor(public readonly editor: ICodeEditor) {
    super(editor);

    this._wrapper = document.createElement('div');
  }

  protected _fillBody(container: HTMLElement): void {
    container.appendChild(this._wrapper);

    this.setTitle('testing peekview widget title', this.current?.test.label);
    this.setCssClass('testing-output-peek-container');
  }

  protected applyClass(): void {
    console.log('applyClass Method not implemented.');
  }

  protected applyStyle(): void {
    const message = this.current!.messages[this.current!.messageIndex];

    ReactDOM.render(<div>{message.message.toString()}</div>, this._wrapper);
  }

  public setModel(dto: TestDto): Promise<void> {
    const message = dto.messages[dto.messageIndex];
    const previous = this.current;

    if (message.type !== TestMessageType.Error) {
      return Promise.resolve();
    }

    if (!dto.revealLocation && !previous) {
      return Promise.resolve();
    }

    this.current = dto;

    this.show(dto.revealLocation!.range, message.location?.range.startLineNumber!);
    this.editor.focus();

    return Promise.resolve();
  }
}
