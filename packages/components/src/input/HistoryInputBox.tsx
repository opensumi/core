import React from 'react';

import { HistoryNavigator } from '@opensumi/monaco-editor-core/esm/vs/base/common/history';

import { IInputBaseProps, Input } from './Input';

export interface HistoryInputBoxProp extends IInputBaseProps {
  // 上层自己持久化历史记录
  history?: string[];
  onReady?: (api: IHistoryInputBoxHandler) => void;
}

export interface IHistoryInputBoxHandler {
  addToHistory: (v: string) => void;
  getHistory: () => string[];
  clearHistory: () => void;
  getCurrentValue: () => string | null;
  showNextValue: () => void;
  showPreviousValue: () => void;
  focus: () => void;
}

export class HistoryInputBox extends React.Component<HistoryInputBoxProp> {
  private inputRef = React.createRef<any>();
  public history: HistoryNavigator<string>;
  public inputProps: HistoryInputBoxProp;

  public readonly state: {
    inputValue: '';
  };

  public componentDidMount() {
    const { history, onReady } = this.props;

    this.history = new HistoryNavigator(history || [], 100);
    this.inputProps = { ...this.props };
    delete this.inputProps.onReady;

    this.setState({
      inputValue: (this.props.value ?? this.props.defaultValue) || '',
    });

    if (typeof onReady === 'function') {
      onReady({
        addToHistory: this.addToHistory,
        getHistory: this.getHistory,
        clearHistory: this.clearHistory,
        getCurrentValue: this.getCurrentValue,
        showNextValue: this.showNextValue,
        showPreviousValue: this.showPreviousValue,
        focus: this.focus,
      });
    }
  }

  public addToHistory = (v: string) => {
    if (this.history && v && v !== this.getCurrentValue()) {
      this.history.add(v);
    }
  };

  public getHistory = (): string[] => (this.history && this.history.getHistory()) || [];

  public showNextValue = () => {
    const value = this.getCurrentValue() || '';
    if (this.history && !this.history.has(value)) {
      this.addToHistory(value);
    }

    let next = this.getNextValue();
    if (next) {
      next = next === value ? this.getNextValue() : next;
    }

    if (next) {
      this.onValueChange(next);
    }
  };

  public showPreviousValue = (): void => {
    const value = this.getCurrentValue() || '';
    if (this.history && !this.history.has(value)) {
      this.addToHistory(value);
    }

    let previous = this.getPreviousValue();
    if (previous) {
      previous = previous === value ? this.getPreviousValue() : previous;
    }

    if (previous) {
      this.onValueChange(previous);
    }
  };

  public clearHistory = (): void => {
    this.history && this.history.clear();
  };

  public getCurrentValue = (): string | null => {
    if (!this.history) {
      return null;
    }

    let currentValue = this.history.current();
    if (!currentValue) {
      currentValue = this.history.last();
      this.history.next();
    }
    return currentValue;
  };

  public getPreviousValue = (): string | null =>
    (this.history && (this.history.previous() || this.history.first())) || null;

  public getNextValue = (): string | null => (this.history && (this.history.next() || this.history.last())) || null;

  public onValueChange = (v: string) => {
    const { onValueChange } = this.props;

    this.setState({
      inputValue: v,
    });

    if (onValueChange) {
      onValueChange(v);
    }
  };

  private onKeyDown = (e) => {
    const { onKeyDown } = this.props;

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  private focus = () => {
    if (this.inputRef && this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  public render() {
    const inputValue = this.state && this.state.inputValue;
    return (
      <Input
        ref={this.inputRef}
        {...this.inputProps}
        onValueChange={this.onValueChange}
        onKeyDown={this.onKeyDown}
        value={inputValue}
      />
    );
  }
}
