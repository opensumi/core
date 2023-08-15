import { StyleProvider } from '@ant-design/cssinjs';
import { Select } from 'antd';
import React, { CSSProperties, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, Emitter, Event } from '@opensumi/ide-core-browser';
import { ConfigProvider } from '@opensumi/ide-core-browser';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { AiInput } from './components/AIInput';

const styles: CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  marginLeft: '66px',
};

@Injectable({ multiple: true })
export class AiZoneWidget extends ZoneWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  private recordLine: number;
  private menus: IMenu;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  private readonly _onSelectChange = new Emitter<string>();
  public readonly onSelectChange: Event<string> = this._onSelectChange.event;

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('ai_widget');

    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <StyleProvider>
          <div style={styles}>
            {/* <InlineActionBar menus={this.menus} type='icon' isFlattenMenu={true} /> */}
            <AiInput onValueChange={(value) => {
              this._onSelectChange.fire(value);
            }}/>
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

    this.menus = menus;
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
