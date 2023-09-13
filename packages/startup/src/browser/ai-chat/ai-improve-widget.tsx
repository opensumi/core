import { StyleProvider } from '@ant-design/cssinjs';
import { Input } from 'antd';
import React, { CSSProperties } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, Emitter, Event } from '@opensumi/ide-core-browser';
import { ConfigProvider } from '@opensumi/ide-core-browser';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

const styles: CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  marginLeft: '66px',
  width: '100%',
  flexDirection: 'column',
};

@Injectable({ multiple: true })
export class AiImproveWidget extends ZoneWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  private recordLine: number;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  private readonly _onClick = new Emitter<string>();
  public readonly onClick: Event<string> = this._onClick.event;

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_widget');

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <StyleProvider>
          <div style={styles}>
            <ul style={{ display: 'flex', alignItems: 'center', paddingLeft: '0', margin:'6px 0 6px 0' }}>
              {[
                { title: '采纳' },
                { title: '|' },
                { title: '丢弃' },
                { title: '|' },
                { title: '优化' },
                { title: '|' },
                { title: '更多指令' },
              ].map(({ title }) => (
                  <li style={{ marginRight: '6px' }}>
                    <a href='javascript:void(0)' onClick={() => {
                      this._onClick.fire(title)
                    }}>{title}</a>
                  </li>
                ))}
            </ul>
            <Input size={'small'} style={{width: 280}} placeholder={'请描述优化方向'}></Input>
          </div>
        </StyleProvider>
      </ConfigProvider>,
      container,
    );
  }

  constructor(editor: ICodeEditor, menus: IMenu) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      // 这里有个小坑，如果不开启这个配置，那么在调用 show 函数的时候会自动对焦并滚动到对应 range，导致在编辑 result 视图中代码时光标总是滚动在最后一个 widget 上
      keepEditorSelection: true,
    });
  }

  // 覆写 revealLine 函数，使其在 show 的时候编辑器不会定位到对应位置
  protected override revealLine(lineNumber: number, isLastLine: boolean): void {
    // not implement
  }

  public getRecordLine(): number {
    return this.recordLine;
  }

  public setContainerStyle(style: { [key in string]: string }): void {
    const keys = Object.keys(style);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.container?.style, key)) {
        this.container!.style[key] = style[key];
      }
    }
  }

  public addClassName(type: string): this {
    this.setCssClass(type);
    return this;
  }

  public showByLine(line: number, lineNumber = 2): void {
    this.recordLine = line;
    super.hide();
    super.show(
      {
        startLineNumber: line,
        startColumn: 0,
        endLineNumber: line,
        endColumn: Number.MAX_SAFE_INTEGER,
      },
      lineNumber,
    );
  }
}
