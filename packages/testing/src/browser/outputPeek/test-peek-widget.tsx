import React from 'react';
import ReactDOM from 'react-dom';
import { PeekViewWidget } from '@opensumi/ide-monaco-enhance/lib/browser/peek-view';
import { Injectable, Autowired } from '@opensumi/di';
import type { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { TestDto } from './test-output-peek';
import { TestMessageType } from '../../common/testCollection';
import './test-peek-widget.less';
import { AppConfig, ConfigProvider, IContextKeyService } from '@opensumi/ide-core-browser';
import { TestingIsInPeek } from '@opensumi/ide-core-browser/lib/contextkey/testing';
import { renderMarkdown } from '@opensumi/monaco-editor-core/esm/vs/base/browser/markdownRenderer';
import { Emitter } from '@opensumi/ide-core-common';
import { TestMessageContainer } from './test-message-container';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';
import { TestPeekMessageToken } from '../../common';

const firstLine = (str: string) => {
  const index = str.indexOf('\n');
  return index === -1 ? str : str.slice(0, index);
};

@Injectable({ multiple: true })
export class TestingOutputPeek extends PeekViewWidget {
  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(TestPeekMessageToken)
  private readonly testingPeekMessageService: TestingPeekMessageServiceImpl;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  public current?: TestDto;
  private _wrapper: HTMLDivElement;

  constructor(public readonly editor: ICodeEditor) {
    super(editor);

    TestingIsInPeek.bind(this.contextKeyService);

    this._wrapper = document.createElement('div');
    this._wrapper.classList.add('test-output-peek-wrapper');
  }

  /**
   * 在这里渲染测试结果
   * 左侧:
   *  - markdown
   *  - plantText
   *  - monaco diff editor (用于 assertEquals)
   * 右侧:
   *  - tree
   */
  protected _fillBody(container: HTMLElement): void {
    container.appendChild(this._wrapper);
    this.setCssClass('testing-output-peek-container');
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <div className='test-output-peek-message-container'>
          <TestMessageContainer />
        </div>
      </ConfigProvider>,
      this._wrapper,
    );
  }

  protected applyClass(): void {
    console.log('applyClass Method not implemented.');
  }

  protected applyStyle(): void {
    console.log('applyStyle Method not implemented.');
  }

  public async showInPlace(dto: TestDto) {
    const message = dto.messages[dto.messageIndex];
    this.setTitle(
      firstLine(
        typeof message.message === 'string' ? message.message : renderMarkdown(message.message).element.outerText,
      ),
      dto.test.label,
    );
    setTimeout(() => {
      this.testingPeekMessageService._didReveal.fire(dto);
      this.testingPeekMessageService._visibilityChange.fire(true);
    });
  }

  public hide(): void {
    super.dispose();
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
    if (!dto.revealLocation) {
      return this.showInPlace(dto);
    }

    this.show(dto.revealLocation!.range, message.location?.range.startLineNumber!);
    this.editor.focus();

    return this.showInPlace(dto);
  }
}
