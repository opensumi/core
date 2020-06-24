import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugSession } from '../debug-session';
import { MessageType, localize } from '@ali/ide-core-browser';
import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';
import { Path } from '@ali/ide-components/lib/utils';

export class ExpressionTreeService {
  constructor(
    private session?: DebugSession,
    private source?: DebugProtocol.Source,
    private line?: number | string) {

  }

  async resolveChildren(parent?: ExpressionContainer): Promise<(ExpressionContainer | DebugVirtualVariable)[]> {
    if (DebugVariableRoot.is(parent) && !parent.variablesReference) {
      return await this.session?.getScopes(parent) || [];
    }
    return await this.doResolve(parent);
  }

  protected async doResolve(parent?: ExpressionContainer): Promise<(ExpressionContainer | DebugVirtualVariable)[]> {
    const result: (ExpressionContainer | DebugVirtualVariable)[] = [];
    if (!parent) {
      return result;
    }
    const { variablesReference, startOfVariables, indexedVariables } = parent;
    if (parent.namedVariables) {
      await this.fetch(result, variablesReference, 'named', parent);
    }
    if (parent.indexedVariables) {
      let chunkSize = ExpressionContainer.BASE_CHUNK_SIZE;
      while (parent.indexedVariables > chunkSize * ExpressionContainer.BASE_CHUNK_SIZE) {
        chunkSize *= ExpressionContainer.BASE_CHUNK_SIZE;
      }
      if (parent.indexedVariables > chunkSize) {
        const numberOfChunks = Math.ceil(parent.indexedVariables / chunkSize);
        for (let i = 0; i < numberOfChunks; i++) {
          const start = parent.startOfVariables + i * chunkSize;
          const count = Math.min(chunkSize, parent.indexedVariables - i * chunkSize);
          result.push(new DebugVirtualVariable({
            session: this.session,
            variablesReference: parent.variablesReference,
            namedVariables: 0,
            indexedVariables: count,
            startOfVariables: start,
            name: `[${start}..${start + count - 1}]`,
          }, parent));
        }
        return result;
      }
    }
    await this.fetch(result, variablesReference, 'indexed', parent, startOfVariables, indexedVariables);
    return result;
  }

  protected fetch(result: any, variablesReference: number, filter: 'named', parent?: ExpressionContainer): Promise<void>;
  protected fetch(result: any, variablesReference: number, filter: 'indexed', parent: ExpressionContainer, start: number, count?: number): Promise<void>;
  protected async fetch(result: any, variablesReference: number, filter: 'indexed' | 'named', parent?: ExpressionContainer, start?: number, count?: number): Promise<void> {
    try {
      const response = await this.session!.sendRequest('variables', { variablesReference, filter, start, count });
      const { variables } = response.body;
      for (const variable of variables) {
        if (variable.variablesReference) {
          result.push(new DebugVariableContainer(this.session, variable, parent, this.source, this.line));
        } else {
          result.push(new DebugVariable((this as any).session, variable, parent));
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

export class ExpressionNode extends TreeNode {
  public source: DebugProtocol.Source | undefined;
  public line: number | string | undefined;
  protected variablesReference: number;
  protected namedVariables: number | undefined;
  protected indexedVariables: number | undefined;

  constructor(options: ExpressionNode.Options, parent?: ExpressionContainer) {
    super(new ExpressionTreeService(options.session, options.source, options.line) as ITree, parent);
    this.variablesReference = options.variablesReference || 0;
    this.namedVariables = options.namedVariables;
    this.indexedVariables = options.indexedVariables;
    this.source = options.source;
    this.line = options.line;
  }

  get badge() {
    return this.source ? `${this.source.name}:${this.line}` : '';
  }

  get tooltip() {
    return '';
  }
}

export namespace ExpressionNode {
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

export class ExpressionContainer extends CompositeTreeNode {

  public static readonly BASE_CHUNK_SIZE = 100;

  protected readonly session: DebugSession | undefined;
  public variablesReference: number;
  public namedVariables: number | undefined;
  public indexedVariables: number | undefined;
  public startOfVariables: number;

  public source: DebugProtocol.Source | undefined;
  public line: number | string | undefined;

  constructor(options: ExpressionContainer.Options, parent?: ExpressionContainer) {
    super(new ExpressionTreeService(options.session, options.source, options.line) as ITree, parent);
    this.session = options.session;
    this.variablesReference = options.variablesReference || 0;
    this.namedVariables = options.namedVariables;
    this.indexedVariables = options.indexedVariables;
    this.startOfVariables = options.startOfVariables || 0;
    this.source = options.source;
    this.line = options.line;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get badge() {
    return this.source ? `${this.source.name}:${this.line}` : '';
  }

  get tooltip() {
    return '';
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

export namespace DebugVirtualVariable {
  export interface Options extends ExpressionContainer.Options {
    name: string;
  }
}

/**
 * 临时的变量节点，如数组节点需要通过该节点插件成[0..100]
 */
export class DebugVirtualVariable extends ExpressionContainer {

  private _name: string;

  constructor(options: DebugVirtualVariable.Options, parent?: ExpressionContainer) {
    super(options, parent);
    this._name = options.name;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get name() {
    return this._name;
  }
}

export class DebugVariable extends ExpressionNode {
  constructor(
    public readonly session: DebugSession | undefined,
    public readonly variable: DebugProtocol.Variable,
    parent?: ExpressionContainer,
  ) {
    super({
      session,
      variablesReference: variable.variablesReference,
      namedVariables: variable.namedVariables,
      indexedVariables: variable.indexedVariables,
    }, parent);
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get name(): string {
    if (this.variable) {
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
    }
    return '';
  }

  get description(): string {
    return this.value;
  }

  protected _value: string | undefined;
  get value(): string {
    return this._value || this.variable.value;
  }

  protected _type: string | undefined;
  get variableType(): string | undefined {
    return this._type || this.variable.type;
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
    } catch (error) {
      throw error;
    }
  }

}

export class DebugVariableContainer extends ExpressionContainer {

  static BOOLEAN_REGEX = /^true|false$/i;
  static STRING_REGEX = /^(['"]).*\1$/;

  constructor(
    public readonly session: DebugSession | undefined,
    protected readonly variable: DebugProtocol.Variable,
    public parent: ExpressionContainer | undefined,
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
    }, parent);
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get name(): string {
    if (this.variable) {
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
    }
    return '';
  }

  get description(): string {
    return this._value || this.variable.value;
  }

  get tooltip(): string {
    return this.variableType || this.description;
  }

  protected _variableType: string | undefined;
  get variableType(): string | undefined {
    return this._variableType || this.variable.type;
  }

  protected _value: string | undefined;
  get value(): string {
    return this._value || this.variable.value;
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
      this._variableType = response.body.type;
      this.variablesReference = response.body.variablesReference || 0;
      this.namedVariables = response.body.namedVariables;
      this.indexedVariables = response.body.indexedVariables;
    } catch (error) {
      throw error;
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

export class DebugScope extends ExpressionContainer {

  constructor(
    protected readonly raw: DebugProtocol.Scope,
    protected readonly session: DebugSession,
    parent?: ExpressionContainer,
  ) {
    super({
      session,
      variablesReference: raw.variablesReference,
      namedVariables: raw.namedVariables,
      indexedVariables: raw.indexedVariables,
    }, parent);
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get name(): string {
    return this.raw ? this.raw.name : '';
  }
}

export class DebugVariableRoot extends DebugVariableContainer {
  static is(node?: ExpressionContainer): node is DebugVariableRoot {
    return !!node && !node.parent;
  }

  constructor(
    public readonly session: DebugSession | undefined,
  ) {
    super(session, {} as any, undefined);
  }

  get expanded() {
    return true;
  }

  get name() {
    return `variableRoot_${this.id}`;
  }
}

export class DebugHoverVariableRoot extends ExpressionContainer {

  static NOT_AVAILABLE = localize('debug.hover.not.available');

  private _value = DebugHoverVariableRoot.NOT_AVAILABLE;

  constructor(
    protected readonly expression: string,
    protected readonly session: DebugSession | undefined,
  ) {
    super({ session });
  }

  get name() {
    return this._value;
  }

  get path() {
    return `${Path.separator}hoverRoot_${this.id}`;
  }

  protected _available = false;
  get available(): boolean {
    return this._available;
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
