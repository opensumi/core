import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugSession } from '../debug-session';
import { MessageType, TreeNode, uuid } from '@ali/ide-core-browser';
import * as styles from '../editor/debug-hover.module.less';
import * as debugConsoleStyles from '../view/debug-console.module.less';
import * as React from 'react';
import * as cls from 'classnames';
import { AnsiConsoleItemView } from './ansi-console-item';

export interface SourceTree<T = any> extends TreeNode {
  description?: string;
  descriptionClass?: string;
  labelClass?: string;
  getChildren?: () => Promise<T[]>;
  tooltip?: string;
  children: T[];
}

export class ExpressionContainer {

  private static readonly BASE_CHUNK_SIZE = 100;

  protected readonly session: DebugSession | undefined;
  protected variablesReference: number;
  protected namedVariables: number | undefined;
  protected indexedVariables: number | undefined;
  protected readonly startOfVariables: number;

  public source: DebugProtocol.Source | undefined;
  public line: number | string | undefined;

  constructor(options: ExpressionContainer.Options) {
    this.session = options.session;
    this.variablesReference = options.variablesReference || 0;
    this.namedVariables = options.namedVariables;
    this.indexedVariables = options.indexedVariables;
    this.startOfVariables = options.startOfVariables || 0;
    this.source = options.source;
    this.line = options.line;
  }

  private _isLoading: boolean = false;

  get isLoading(): boolean {
    return this._isLoading;
  }

  get badge() {
    return this.source ? `${this.source.name}:${this.line}` : '';
  }

  get hasChildren(): boolean {
    return !!this.variablesReference;
  }

  children: any[] = [];

  async getChildren(): Promise<ExpressionContainer[]> {
    this._isLoading = true;
    if (!this.hasChildren || !this.session) {
      return [];
    }
    if (this.children.length === 0) {
      this.children = await this.doResolve();
    }
    this._isLoading = false;
    return this.children;
  }

  protected async doResolve(): Promise<ExpressionContainer[]> {
    const result: ExpressionContainer[] = [];
    if (this.namedVariables) {
      await this.fetch(result, 'named');
    }
    if (this.indexedVariables) {
      let chunkSize = ExpressionContainer.BASE_CHUNK_SIZE;
      while (this.indexedVariables > chunkSize * ExpressionContainer.BASE_CHUNK_SIZE) {
        chunkSize *= ExpressionContainer.BASE_CHUNK_SIZE;
      }
      if (this.indexedVariables > chunkSize) {
        const numberOfChunks = Math.ceil(this.indexedVariables / chunkSize);
        for (let i = 0; i < numberOfChunks; i++) {
          const start = this.startOfVariables + i * chunkSize;
          const count = Math.min(chunkSize, this.indexedVariables - i * chunkSize);
          const { session, variablesReference } = this;
          result.push(new DebugVirtualVariable({
            session, variablesReference,
            namedVariables: 0,
            indexedVariables: count,
            startOfVariables: start,
            name: `[${start}..${start + count - 1}]`,
          }));
        }
        return result;
      }
    }
    await this.fetch(result, 'indexed', this.startOfVariables, this.indexedVariables);
    return result;
  }

  protected fetch(result: any, filter: 'named'): Promise<void>;
  protected fetch(result: any, filter: 'indexed', start: number, count?: number): Promise<void>;
  protected async fetch(result: any, filter: 'indexed' | 'named', start?: number, count?: number): Promise<void> {
    try {
      const { variablesReference } = this;
      const response = await this.session!.sendRequest('variables', { variablesReference, filter, start, count });
      const { variables } = response.body;
      // 变量去重
      const names = new Set<string>();
      for (const variable of variables) {
        if (variable.variablesReference) {
          if (!names.has(variable.name)) {
            names.add(variable.name);
            // 根节点的构造器为ExpressionContainer
            if (!(this instanceof DebugVariable)) {
              delete variable.name;
              result.push(new DebugVariable(this.session, variable, this, this.source, this.line));
            } else {
              result.push(new DebugVariable((this as any).session, variable, this));
            }
          }
        } else {
          result.push(new DebugVariable((this as any).session, variable, this));
        }
      }
    } catch (e) {
      result.push({
        severity: MessageType.Error,
        visible: !!e.message,
        message: e.message,
      });
    }
  }
}

export namespace ExpressionContainer {
  export interface Options {
    session: DebugSession | undefined;
    variablesReference?: number;
    namedVariables?: number;
    indexedVariables?: number;
    startOfVariables?: number;
    source?: DebugProtocol.Source;
    line?: number | string;
  }
}

export class DebugVariable extends ExpressionContainer implements SourceTree<ExpressionContainer> {

  static booleanRegex = /^true|false$/i;
  static stringRegex = /^(['"]).*\1$/;

  constructor(
    public readonly session: DebugSession | undefined,
    protected readonly variable: DebugProtocol.Variable,
    // TODO: 修复类型检查
    public readonly parent: any,
    source?: DebugProtocol.Source,
    line?: string | number,
  ) {
    super({
      session,
      variablesReference: variable.variablesReference,
      namedVariables: variable.namedVariables,
      indexedVariables: variable.indexedVariables,
      source,
      line,
    });
  }
  // 根节点不展示前置Name
  public afterLabel: string =  !this.name ? '' : ': ';

  get id() {
    return this.variablesReference || this.parent ? `${this.parent.variablesReference}_${this.name}` : uuid() ;
  }

  get name(): string {
    if (this.variable.name) {
      return this.variable.name;
    } else if (this.variable.evaluateName) {
      const isSymbolExpression = /\["(.+)"]/.exec(this.variable.evaluateName);
      if (isSymbolExpression) {
        return isSymbolExpression[1];
      } else {
        const evaluateProps = this.variable.evaluateName.split('.');
        return evaluateProps[evaluateProps.length - 1];
      }
    }
    return '';
  }

  get description(): string {
    return this._value || this.variable.value;
  }

  get tooltip(): string {
    return this.type || this.description;
  }

  get descriptionClass() {
    return this.variableClassName;
  }

  get labelClass(): string {
    return [styles.debug_console_variable, styles.name].join(' ');
  }

  protected _type: string | undefined;
  get type(): string | undefined {
    return this._type || this.variable.type;
  }

  protected _value: string | undefined;
  get value(): string {
    return this._value || this.variable.value;
  }

  get variableClassName(): string {
    const { type, value } = this;
    const classNames = [styles.debug_console_variable];
    if (type === 'number' || type === 'boolean' || type === 'string') {
      classNames.push(styles[type]);
    } else if (!isNaN(+value)) {
      classNames.push(styles.number);
    } else if (DebugVariable.booleanRegex.test(value)) {
      classNames.push(styles.boolean);
    } else if (DebugVariable.stringRegex.test(value)) {
      classNames.push(styles.string);
    }
    return classNames.join(' ');
  }

  get supportSetVariable(): boolean {
    return !!this.session && !!this.session.capabilities.supportsSetVariable;
  }

  async setValue(value: string): Promise<void> {
    if (!this.session) {
      return;
    }
    const { name, parent } = this as any;
    const variablesReference = parent.variablesReference;
    try {
      const response = await this.session.sendRequest('setVariable', { variablesReference, name, value });
      this._value = response.body.value;
      this._type = response.body.type;
      this.variablesReference = response.body.variablesReference || 0;
      this.namedVariables = response.body.namedVariables;
      this.indexedVariables = response.body.indexedVariables;
      this.session.fireDidChange();
    } catch (error) {
      console.error(error);
    }
  }

  get supportCopyValue(): boolean {
    return !!this.valueRef && document.queryCommandSupported('copy');
  }

  copyValue(): void {
    const selection = document.getSelection();
    if (this.valueRef && selection) {
      selection.selectAllChildren(this.valueRef);
      document.execCommand('copy');
    }
  }

  protected valueRef: HTMLSpanElement | undefined;
  protected setValueRef = (valueRef: HTMLSpanElement | null) => this.valueRef = valueRef || undefined;

  get supportCopyAsExpression(): boolean {
    return !!this.nameRef && document.queryCommandSupported('copy');
  }
  copyAsExpression(): void {
    const selection = document.getSelection();
    if (this.nameRef && selection) {
      selection.selectAllChildren(this.nameRef);
      document.execCommand('copy');
    }
  }
  protected nameRef: HTMLSpanElement | undefined;
  protected setNameRef = (nameRef: HTMLSpanElement | null) => this.nameRef = nameRef || undefined;
}

export class DebugVirtualVariable extends ExpressionContainer {

  constructor(
    protected readonly options: VirtualVariableItem.Options,
  ) {
    super(options);
  }
}

export namespace VirtualVariableItem {
  export interface Options extends ExpressionContainer.Options {
    name: string;
  }
}

export class ExpressionItem extends ExpressionContainer {

  static notAvailable = 'not available';

  private _value = ExpressionItem.notAvailable;
  private _id = '';

  get name(): string {
    return this._value;
  }

  get id(): string {
    return this._id;
  }

  protected _available = false;
  get available(): boolean {
    return this._available;
  }

  constructor(
    protected readonly expression: string,
    protected readonly session: DebugSession | undefined,
  ) {
    super({ session });
    this._id = uuid();
  }

  async evaluate(context: string = 'repl'): Promise<void> {
    if (this.session) {
      try {
        const { expression } = this;
        const body = await this.session.evaluate(expression, context);
        if (body) {
          this._value = body.result;
          this._available = true;
          this.variablesReference = body.variablesReference;
          this.namedVariables = body.namedVariables;
          this.indexedVariables = body.indexedVariables;
          if (this.variablesReference > 0) {
            this.children = [];
          }
        }
      } catch (err) {
        this._value = err.message;
        this._available = false;
      }
    } else {
      this._value = 'Please start a debug session to evaluate';
      this._available = false;
    }
  }

}

export class DebugScope extends ExpressionContainer {

  constructor(
    protected readonly raw: DebugProtocol.Scope,
    protected readonly session: DebugSession,
  ) {
    super({
      session,
      variablesReference: raw.variablesReference,
      namedVariables: raw.namedVariables,
      indexedVariables: raw.indexedVariables,
    });
  }

  get id() {
    return this.raw.variablesReference;
  }

  get name(): string {
    return this.raw.name;
  }

}

export class AnsiConsoleItem implements SourceTree {
  public labelClass: string;

  constructor(
    public readonly content: string,
    public readonly severity?: MessageType,
    public readonly source?: DebugProtocol.Source,
    public readonly line?: string | number,

  ) {
    this.labelClass = this.getColor(severity);
  }

  getColor(severity?: MessageType): string {
    if (typeof severity === 'undefined') {
      return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.info);
    }
    switch (severity) {
      case MessageType.Error:
        return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.error);
      case MessageType.Warning:
        return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.warn);
      case MessageType.Info:
        return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.info);
      default:
        return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.info);
    }
  }

  get id() {
    return uuid();
  }

  get name(): any {
    return () => {
      return <AnsiConsoleItemView content={this.content} severity={this.severity}/>;
    };
  }

  get children() {
    return [];
  }

  get parent() {
    return undefined;
  }

  get badge() {
    if (this.source) {
      return `${this.source.name}:${this.line}`;
    }
    return '';
  }
}

export class ExpressionWatchItem extends ExpressionContainer {

  static notAvailable = 'not available';

  private _value = ExpressionItem.notAvailable;
  private _title = '';
  private _id = '';

  get name(): string {
    return this._title;
  }

  get description(): string {
    return this._available ? this._value : 'not available';
  }

  get id(): string {
    return this._id;
  }

  get labelClass(): string {
    return [styles.debug_console_variable, styles.name].join(' ');
  }

  protected _available = false;
  get available(): boolean {
    return this._available;
  }

  constructor(
    protected readonly expression: string,
    protected readonly session: DebugSession | undefined,
  ) {
    super({ session });
    this._id = uuid();
  }

  async evaluate(context: string = 'repl'): Promise<void> {
    if (this.session) {
      try {
        const { expression } = this;
        const body = await this.session.evaluate(expression, context);
        if (body) {
          this._title = this.expression;
          this._value = body.result;
          this._available = true;
          this.variablesReference = body.variablesReference;
          this.namedVariables = body.namedVariables;
          this.indexedVariables = body.indexedVariables;
          this.children = [];
        }
      } catch (err) {
        this._title = this.expression;
        this._available = false;
      }
    } else {
      this._title = this.expression;
      this._available = false;
    }
  }

}
