import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ZoneWidget } from '@ali/ide-monaco-enhance';
import { DebugEditor, IDebugModel } from '../../common';
import * as styles from './debug-breakpoint.module.less';
import { Select } from '@ali/ide-core-browser/lib/components/select';
import { DebugProtocol } from 'vscode-debugprotocol';

export class DebugBreakpointZoneWidget extends ZoneWidget {

  private _wrapper: HTMLDivElement;
  private _selection: HTMLDivElement;
  private _input: HTMLInputElement;

  private _model: IDebugModel;

  protected context: DebugBreakpointZoneWidget.Context = 'condition';
  // 存储不同context下的input值
  protected _values: {
    [context in DebugBreakpointZoneWidget.Context]?: string
  } = {};

  constructor(editor: DebugEditor, model: IDebugModel) {
    super(editor);

    this._model = model;
    this._wrapper = document.createElement('div');
    this._selection = document.createElement('div');
    this._input = document.createElement('input');
    this._container.appendChild(this._wrapper);
    this._wrapper.appendChild(this._selection);
    this._wrapper.appendChild(this._input);
  }

  protected renderOption(context: DebugBreakpointZoneWidget.Context, label: string): JSX.Element {
    return <option value={context}>{label}</option>;
  }

  protected readonly updateInput = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (this._input) {
        this._values[this.context] = this._input.value;
    }
    this.context = e.currentTarget.value as DebugBreakpointZoneWidget.Context;
    this.render();
    if (this._input) {
      this._input.focus();
    }
  }

  applyClass() {
    this._wrapper.className = styles.debug_breakpoint_wrapper;
    this._selection.className = styles.debug_breakpoint_selected;
    this._input.className = styles.debug_breakpoint_input;
  }

  applyStyle() {
    if (this._input) {
      this._input.setAttribute('placeholder', '在表达式结果为真时中断。按 \"Enter\" 键确认，\"Esc\" 键取消。');
      this._input.value = this._values[this.context] || '';
    }
    ReactDOM.render(<Select value={this.context} onChange={this.updateInput}>
      {this.renderOption('condition', 'Expression')}
      {this.renderOption('hitCondition', 'Hit Count')}
      {this.renderOption('logMessage', 'Log Message')}
    </Select>, this._selection);
  }

}

export namespace DebugBreakpointZoneWidget {
  export type Context = keyof Pick<DebugProtocol.SourceBreakpoint, 'condition' | 'hitCondition' | 'logMessage'>;
}
