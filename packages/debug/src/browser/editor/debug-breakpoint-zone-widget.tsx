import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ZoneWidget } from '@ali/ide-monaco-enhance';
import { DebugEditor, IDebugModel } from '../../common';
import * as styles from './debug-breakpoint.module.less';
import { Select } from '@ali/ide-core-browser/lib/components/select';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Input } from '@ali/ide-core-browser/lib/components';
import { localize } from '@ali/ide-core-node';
import { KeyCode, Key, Emitter } from '@ali/ide-core-browser';

export interface BreakpointChangeData {
  context: DebugBreakpointZoneWidget.Context;
  value: string;
}

export class DebugBreakpointZoneWidget extends ZoneWidget {

  private _wrapper: HTMLDivElement;
  private _selection: HTMLDivElement;
  private _input: HTMLDivElement;

  protected readonly _onDidChangeBreakpoint = new Emitter<BreakpointChangeData>();
  readonly onDidChangeBreakpoint = this._onDidChangeBreakpoint.event;

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
    this._input = document.createElement('div');
    this._container.appendChild(this._wrapper);
    this._wrapper.appendChild(this._selection);
    this._wrapper.appendChild(this._input);
  }

  protected renderOption(context: DebugBreakpointZoneWidget.Context, label: string): JSX.Element {
    return <option value={context}>{label}</option>;
  }

  protected readonly updateInput = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.context = e.currentTarget.value as DebugBreakpointZoneWidget.Context;
    this.render();
  }

  protected readonly inputChangeHandler = (e) => {
    this._values[this.context] = e.target!.value;
  }

  protected readonly inputKeyDownHandler = (event) => {
    const { key } = KeyCode.createKeyCode(event.nativeEvent);
    if (key && Key.ENTER.keyCode === key.keyCode) {
      event.stopPropagation();
      event.preventDefault();
      this._onDidChangeBreakpoint.fire({
        context: this.context,
        value: this._values[this.context] || '',
      });
      this.dispose();
    } else if (key && Key.ESCAPE.keyCode === key.keyCode) {
      event.stopPropagation();
      event.preventDefault();
      this.dispose();
    }
  }

  applyClass() {
    this._wrapper.className = styles.debug_breakpoint_wrapper;
    this._selection.className = styles.debug_breakpoint_selected;
    this._input.className = styles.debug_breakpoint_input;
  }

  applyStyle() {
    ReactDOM.render(<Input autoFocus={true} placeholder={localize('debug.expression.placeholder')} value={this._values[this.context]} onChange={this.inputChangeHandler} onKeyDown={this.inputKeyDownHandler}/>, this._input);
    ReactDOM.render(<Select value={this.context} onChange={this.updateInput}>
      {this.renderOption('condition', localize('debug.expression.condition'))}
      {this.renderOption('hitCondition', localize('debug.expression.hitCondition'))}
      {this.renderOption('logMessage', localize('debug.expression.logMessage'))}
    </Select>, this._selection);
  }

}

export namespace DebugBreakpointZoneWidget {
  export type Context = keyof Pick<DebugProtocol.SourceBreakpoint, 'condition' | 'hitCondition' | 'logMessage'>;
}
