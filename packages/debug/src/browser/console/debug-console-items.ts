import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugSession } from '../debug-session';
import { MessageType, TreeNode } from '@ali/ide-core-browser';
import * as styles from '../editor/debug-hover.module.less';

export interface SourceTree<T> extends TreeNode {
  name: string;
  description: string;
  descriptionClass: string;
  labelClass: string;
  getChildren: () => Promise<T[]>;
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

  constructor(options: ExpressionContainer.Options) {
    this.session = options.session;
    this.variablesReference = options.variablesReference || 0;
    this.namedVariables = options.namedVariables;
    this.indexedVariables = options.indexedVariables;
    this.startOfVariables = options.startOfVariables || 0;
  }

  get hasChildren(): boolean {
    return !!this.variablesReference;
  }

  public afterLabel: string =  ': ';

  children: any[] = [];

  async getChildren(): Promise<ExpressionContainer[]> {
    if (!this.hasChildren || !this.session) {
      return [];
    }
    if (this.children.length === 0) {
      this.children = await this.doResolve();
    }
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
      const names = new Set<string>();
      for (const variable of variables) {
        if (!names.has(variable.name)) {
          result.push(new DebugVariable(this.session, variable, this));
          names.add(variable.name);
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
  }
}

export class DebugVariable extends ExpressionContainer implements SourceTree<ExpressionContainer> {

  static booleanRegex = /^true|false$/i;
  static stringRegex = /^(['"]).*\1$/;

  constructor(
    protected readonly session: DebugSession | undefined,
    protected readonly variable: DebugProtocol.Variable,
    // TODO: 修复类型检查
    public readonly parent: any,
  ) {
    super({
      session,
      variablesReference: variable.variablesReference,
      namedVariables: variable.namedVariables,
      indexedVariables: variable.indexedVariables,
    });
  }

  get id() {
    return this.variablesReference;
  }

  get name(): string {
    return this.variable.name;
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
    return [styles.kaitian_debug_console_variable, styles.name].join(' ');
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
    const classNames = [styles.kaitian_debug_console_variable];
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

  protected _value = ExpressionItem.notAvailable;
  get value(): string {
    return this._value;
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
          this.children = [];
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
    console.log(raw , 'raw --->');
  }

  get id() {
    return this.raw.indexedVariables;
  }

  get name(): string {
    return this.raw.name;
  }

}
