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

export type DebugBreakpointWidgetContext = {
  [context in DebugBreakpointZoneWidget.Context]?: string;
};

export class DebugBreakpointZoneWidget extends ZoneWidget {

  private _wrapper: HTMLDivElement;
  private _selection: HTMLDivElement;
  private _input: HTMLDivElement;

  protected readonly _onDidChangeBreakpoint = new Emitter<BreakpointChangeData>();
  readonly onDidChangeBreakpoint = this._onDidChangeBreakpoint.event;

  protected readonly _onFocus = new Emitter<void>();
  readonly onFocus = this._onFocus.event;

  protected readonly _onBlur = new Emitter<void>();
  readonly onBlur = this._onBlur.event;

  protected context: DebugBreakpointZoneWidget.Context;

  private textInput: HTMLInputElement | null;

  // 存储不同context下的input值
  protected _values: DebugBreakpointWidgetContext;

  get values() {
    return {
      ...this._values,
      [this.context]: this.textInput ? this.textInput.value || undefined : undefined,
    };
  }

  constructor(editor: DebugEditor, contexts: DebugBreakpointWidgetContext = {}, defaultContext: DebugBreakpointZoneWidget.Context = 'condition') {
    super(editor);

    this._values = contexts;
    this.context = defaultContext;

    this._wrapper = document.createElement('div');
    this._selection = document.createElement('div');
    this._input = document.createElement('div');
    this._container.appendChild(this._wrapper);
    this._wrapper.appendChild(this._selection);
    this._wrapper.appendChild(this._input);

    ReactDOM.render(<Input
      placeholder={this.placeholder}
      defaultValue={this._values[this.context]}
      ref={(input) => {this.textInput = input; }}
      onFocus={this.inputFocusHandler}
      onBlur={this.inputBlurHandler}
    />, this._input, () => {
      if (!!this.textInput) {
        this.textInput.focus();
      }
    });
  }

  protected renderOption(context: DebugBreakpointZoneWidget.Context, label: string): JSX.Element {
    return <option value={context}>{label}</option>;
  }

  protected readonly updateInput = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!!this.textInput) {
      this._values[this.context] = this.textInput.value || undefined;
    }
    this.context = e.currentTarget.value as DebugBreakpointZoneWidget.Context;
    this.render();
  }

  protected readonly inputFocusHandler = () => {
    this._onFocus.fire();
  }

  protected readonly inputBlurHandler = () => {
    this._onBlur.fire();
  }

  applyClass() {
    this._wrapper.className = styles.debug_breakpoint_wrapper;
    this._selection.className = styles.debug_breakpoint_selected;
    this._input.className = styles.debug_breakpoint_input;
  }

  applyStyle() {
    if (this.textInput) {
      this.textInput.value = this._values[this.context] || '';
      this.textInput.setAttribute('placeholder', this.placeholder);
    }
    ReactDOM.render(<Select value={this.context} onChange={this.updateInput}>
      {this.renderOption('condition', localize('debug.expression.condition'))}
      {this.renderOption('hitCondition', localize('debug.expression.hitCondition'))}
      {this.renderOption('logMessage', localize('debug.expression.logMessage'))}
    </Select>, this._selection);
  }

  get placeholder() {
    if (this.context === 'logMessage') {
      return localize('debug.expression.log.placeholder');
    } else if (this.context === 'hitCondition') {
      return localize('debug.expression.hit.placeholder');
    } else {
      return localize('debug.expression.condition.placeholder');
    }
  }
}

export namespace DebugBreakpointZoneWidget {
  export type Context = keyof Pick<DebugProtocol.SourceBreakpoint, 'condition' | 'hitCondition' | 'logMessage'>;
}
