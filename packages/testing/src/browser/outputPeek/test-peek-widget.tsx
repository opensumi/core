import React from 'react';
import ReactDOM from 'react-dom';
import { PeekViewWidget } from '@opensumi/ide-monaco-enhance/lib/browser/peek-view';
import { Injectable, Autowired } from '@opensumi/di';
import type { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { TestDto } from './test-output-peek';
import { TestMessageType } from '../../common/testCollection';
import './test-peek-widget.less';
import { AppConfig, ConfigProvider, IContextKeyService } from '@opensumi/ide-core-browser';
import { renderMarkdown } from '@opensumi/monaco-editor-core/esm/vs/base/browser/markdownRenderer';
import { TestMessageContainer } from './test-message-container';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';
import { TestPeekMessageToken } from '../../common';
import { TestTreeContainer } from './test-tree-container';
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { firstLine, hintMessagePeekHeight } from '../../common/testingStates';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { AbstractMenuService, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

@Injectable({ multiple: true })
export class TestingOutputPeek extends PeekViewWidget {
  @Autowired(TestPeekMessageToken)
  private readonly testingPeekMessageService: TestingPeekMessageServiceImpl;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  public current?: TestDto;

  constructor(public readonly editor: ICodeEditor, private readonly contextKeyService: IContextKeyService) {
    super(editor, { isResizeable: true });
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
    this.setCssClass('testing-output-peek-container');
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <SplitPanel overflow='hidden' id='testing-message-horizontal' flex={1}>
          <TestMessageContainer />
          <TestTreeContainer />
        </SplitPanel>
      </ConfigProvider>,
      container,
    );
  }

  protected async _fillActionBarOptions(container: HTMLElement): Promise<void> {
    const menus = this.menuService.createMenu(MenuId.TestPeekTitleContext, this.contextKeyService);
    return new Promise((res) => {
      ReactDOM.render(
        <ConfigProvider value={this.configContext}>
          <InlineActionBar menus={menus} type='icon' context={[this.editor.getModel()?.uri.toString()!]} />
        </ConfigProvider>,
        container,
        res,
      );
    });
  }

  protected applyClass(): void {
    // not implemented
  }

  protected applyStyle(): void {
    // not implemented
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
    if (this._bodyElement) {
      ReactDOM.unmountComponentAtNode(this._bodyElement);
    }
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

    this.show(dto.revealLocation!.range, hintMessagePeekHeight(message));
    this.editor.focus();

    return this.showInPlace(dto);
  }
}
