import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ZoneWidget } from '@ali/ide-monaco-enhance';
import { DebugEditor } from '../../common';
import * as styles from './debug-breakpoint.module.less';
import { DebugProtocol } from '@ali/vscode-debugprotocol';
import { Input, Select } from '@ali/ide-components';
import { localize, Emitter, Event } from '@ali/ide-core-common';

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
  readonly onDidChangeBreakpoint: Event<BreakpointChangeData> = this._onDidChangeBreakpoint.event;

  protected readonly _onFocus = new Emitter<void>();
  readonly onFocus: Event<void> = this._onFocus.event;

  protected readonly _onBlur = new Emitter<void>();
  readonly onBlur: Event<void> = this._onBlur.event;

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

  get breakpointType(): DebugBreakpointZoneWidget.Context {
    return this.context;
  }

  constructor(
    editor: DebugEditor,
    contexts: DebugBreakpointWidgetContext = {},
    defaultContext: DebugBreakpointZoneWidget.Context = 'condition',
  ) {
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
      autoFocus={true}
      defaultValue={this._values[this.context]}
      ref={(input) => {this.textInput = input; }}
      onFocus={this.inputFocusHandler}
      onBlur={this.inputBlurHandler}
    />, this._input);
  }

  protected renderOption(context: DebugBreakpointZoneWidget.Context, label: string): JSX.Element {
    return <option value={context}>{label}</option>;
  }

  protected readonly inputFocusHandler = () => {
    this._onFocus.fire();
  }

  protected readonly inputBlurHandler = () => {
    this._onBlur.fire();
  }

  protected readonly selectContextHandler = (value: any) => {
    if (this.textInput) {
      this._values[this.context] = this.textInput.value || undefined;
    }
    this.context = value as DebugBreakpointZoneWidget.Context;
    this.render();
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
      this.textInput.focus();
    }
    ReactDOM.render(<Select value={this.context} selectedRenderer={() => {
      return <span className='kt-select-option'>{this.getContextToLocalize(this.context)}</span>;
    }} onChange={this.selectContextHandler}>
      {this.renderOption('condition', this.getContextToLocalize('condition'))}
      {this.renderOption('hitCondition', this.getContextToLocalize('hitCondition'))}
      {this.renderOption('logMessage', this.getContextToLocalize('logMessage'))}
    </Select>, this._selection);
  }

  getContextToLocalize(ctx: DebugBreakpointZoneWidget.Context) {
    if (ctx === 'logMessage') {
      return localize('debug.expression.logMessage');
    } else if (ctx === 'hitCondition') {
      return localize('debug.expression.hitCondition');
    } else {
      return localize('debug.expression.condition');
    }
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
