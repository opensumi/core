import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { AppConfig, ConfigProvider, getExternalIcon } from '@opensumi/ide-core-browser';
import { AiInput } from '../components/AIInput';
import { AIImprove } from '../components/AIImprove';

import * as styles from '../ai-chat.module.less';

export interface IAiContentWidget extends monaco.editor.IContentWidget {
  show: (options?: ShowAiContentOptions | undefined) => void;
  hide: (options?: ShowAiContentOptions | undefined) => void;
}

export interface ShowAiContentOptions {
  /**
   * 选中区域
   */
  selection: monaco.Range;
}

@Injectable({ multiple: true })
export class AiContentWidget extends Disposable implements IAiContentWidget {

  @Autowired(AppConfig)
  private configContext: AppConfig;

  allowEditorOverflow?: boolean | undefined = true;
  suppressMouseDown?: boolean | undefined = false;

  private domNode: HTMLElement;
  protected options: ShowAiContentOptions | undefined;

  private readonly _onSelectChange = new Emitter<string>();
  public readonly onSelectChange: Event<string> = this._onSelectChange.event;

  constructor(private readonly editor: IMonacoCodeEditor) {
    super();

    this.hide();
    this.renderView();
  }

  override dispose(): void {
    this.hide()
    super.dispose();
  }

  private renderView(): void {
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <div>
          <div className={'ai-shortcuts'}>
            <AIImprove onClick={(title) => {
              console.log('title:>>>>', title)
              this._onSelectChange.fire(title);
            }} lists={[
              {
                title: '解释代码',
                iconClass: getExternalIcon('git-pull-request')
              },
              {
                title: '｜',
                iconClass: ''
              },
              {
                title: '生成注释',
                iconClass: getExternalIcon('git-pull-request')
              },
              {
                title: '｜',
                iconClass: ''
              },
              {
                title: '优化代码',
                iconClass: getExternalIcon('git-pull-request')
              },
              {
                title: '｜',
                iconClass: ''
              },
              {
                title: '其他',
                iconClass: getExternalIcon('git-pull-request')
              }
            ]}/>
          </div>
          <div className={styles.ai_content_widget_input}>
            <AiInput onValueChange={(value) => {
              this._onSelectChange.fire(value);
            }}/>
          </div>
        </div>
      </ConfigProvider>,
      this.getDomNode(),
    );
    this.layoutContentWidget();
  }

  async show(options?: ShowAiContentOptions | undefined): Promise<void> {
    if (!options) {
      return;
    }

    if (this.options && this.options.selection.equalsRange(options.selection)) {
      return;
    }

    this.options = options;

    this.editor.addContentWidget(this);
  }

  hide: (options?: ShowAiContentOptions | undefined) => void = () => {
    this.options = undefined;
    this.editor.removeContentWidget(this);
  };

  getId(): string {
    return 'AI-Content-Widget';
  }

  protected layoutContentWidget(): void {
    this.editor.layoutContentWidget(this);
  }

  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = document.createElement('div');
      this.domNode.classList.add(this.getId());
    }
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition | null {
    const endPosition = this.options && this.options.selection.getEndPosition();
    return endPosition
      ? {
          // @ts-ignore
          position: new monaco.Position(endPosition.lineNumber, this.options?.selection.startColumn),
          preference: [
            monaco.editor.ContentWidgetPositionPreference.BELOW,
          ],
        }
      : null;
  }
}
