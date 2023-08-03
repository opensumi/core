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

const { Option } = Select;

const AiInput = ({ onValueChange }) => {
  const [data, setData] = useState<any>([]);
  const [value, setValue] = useState<string>();

  const createItem = useCallback(
    (iconName: string, value: string) => ({
      iconName,
      value,
    }),
    [],
  );

  const handleSearch = (newValue: string) => {
    if (newValue === '/') {
      setData([
        createItem('file-binary', '给出测试用例'),
        createItem('edit', '优化一下代码'),
        createItem('info', '为代码添加注释'),
        createItem('tools', '补全代码中缺失的部分'),
        createItem('code', '检查下代码是否有问题'),
        createItem('wand', '按照我的想法修改代码，具体的想法是...'),
        createItem('code', '用别的语言写这段代码，比如...'),
      ]);
    } else {
      setData([]);
    }
  };

  const handleChange = (newValue: string) => {
    console.log('select handleChange:>>> ', newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
    setValue(newValue);
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder={'输入 /，针对选中代码，唤醒 AI 任务'}
      style={{ width: 320 }}
      defaultActiveFirstOption={false}
      showArrow={false}
      filterOption={false}
      onSearch={handleSearch}
      size={'small'}
      onChange={handleChange}
      suffixIcon={<span className={getExternalIcon('send')}></span>}
      notFoundContent={null}
    >
      {data.map(({ iconName, value }, i) => (
        <Option key={i} value={value}>
          <div style={{display: 'flex', alignItems: 'center'}}>
            <span style={{marginRight: 6}} className={getExternalIcon(iconName)}></span>
            <span>{value}</span>
          </div>
        </Option>
      ))}
    </Select>
  );
};

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
