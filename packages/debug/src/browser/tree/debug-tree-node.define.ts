import { TreeNode, CompositeTreeNode, ITree, ITreeNodeOrCompositeTreeNode } from '@opensumi/ide-components';
import { MessageType, localize } from '@opensumi/ide-core-browser';
import { IRange } from '@opensumi/ide-core-common';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { DebugSession } from '../debug-session';

import { AnsiConsoleNode } from './debug-console-tree-node.define';


export class ExpressionTreeService {
  constructor(private session?: DebugSession, private source?: DebugProtocol.Source, private line?: number | string) {}

  async resolveChildren(
    parent?: ExpressionContainer,
  ): Promise<(ExpressionContainer | ExpressionNode | DebugVirtualVariable)[]> {
    if (DebugVariableRoot.is(parent) && !parent.variablesReference && !parent.presetChildren) {
      return (await this.session?.getScopes(parent)) || [];
    }
    return await this.doResolve(parent);
  }

  protected async doResolve(
    parent?: ExpressionContainer,
  ): Promise<(ExpressionContainer | DebugVirtualVariable | ExpressionNode)[]> {
    const result: (ExpressionContainer | DebugVirtualVariable)[] = [];
    if (!parent) {
      return result;
    }
    if (Array.isArray(parent.presetChildren)) {
      return parent.presetChildren;
    }
    if (!this.session || this.session.terminated) {
      return result;
    }
    const { variablesReference, startOfVariables, indexedVariables } = parent;
    if (parent.namedVariables) {
      await this.fetch(result, variablesReference, 'named', parent);
    }
    if (indexedVariables) {
      let chunkSize = ExpressionContainer.BASE_CHUNK_SIZE;
      while (indexedVariables > chunkSize * ExpressionContainer.BASE_CHUNK_SIZE) {
        chunkSize *= ExpressionContainer.BASE_CHUNK_SIZE;
      }
      if (indexedVariables > chunkSize) {
        const numberOfChunks = Math.ceil(indexedVariables / chunkSize);
        for (let i = 0; i < numberOfChunks; i++) {
          const start = parent.startOfVariables + i * chunkSize;
          const count = Math.min(chunkSize, indexedVariables - i * chunkSize);
          result.push(
            new DebugVirtualVariable(
              {
                session: this.session,
                variablesReference: parent.variablesReference,
                namedVariables: 0,
                indexedVariables: count,
                startOfVariables: start,
                name: `[${start}..${start + count - 1}]`,
              },
              parent,
            ),
          );
        }
        return result;
      }
    }
    await this.fetch(result, variablesReference, 'indexed', parent, startOfVariables, indexedVariables);
    return result;
  }

  protected fetch(
    result: any,
    variablesReference: number,
    filter: 'named',
    parent?: ExpressionContainer,
  ): Promise<void>;
  protected fetch(
    result: any,
    variablesReference: number,
    filter: 'indexed',
    parent: ExpressionContainer,
    start: number,
    count?: number,
  ): Promise<void>;
  protected async fetch(
    result: any,
    variablesReference: number,
    filter: 'indexed' | 'named',
    parent?: ExpressionContainer,
    start?: number,
    count?: number,
  ): Promise<void> {
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

  // 可折叠节点展示优先级默认较低
  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
    }
    return CompositeTreeNode.is(a) ? 1 : CompositeTreeNode.is(b) ? -1 : 0;
  }
}

export class DebugConsoleTreeService extends ExpressionTreeService {
  // 按照默认次序排序
  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (!a) {
      return 1;
    }
    if (!b) {
      return -1;
    }
    return 0;
  }
}

export class ExpressionNode extends TreeNode {
  public source: DebugProtocol.Source | undefined;
  public line: number | string | undefined;
  public variablesReference: number;
  public namedVariables: number | undefined;
  public indexedVariables: number | undefined;

  constructor(options: ExpressionNode.Options, parent?: ExpressionContainer) {
    super(new ExpressionTreeService(options.session, options.source, options.line) as ITree, parent, undefined, {
      name: String(options.session?.id),
    });
    this.variablesReference = options.variablesReference || 0;
    this.namedVariables = options.namedVariables;
    this.indexedVariables = options.indexedVariables;
    this.source = options.source;
    this.line = options.line;
  }

  get badge() {
    return this.source ? `${this.source.name}:${this.line}` : '';
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

  public presetChildren: (ExpressionContainer | ExpressionNode)[];

  constructor(options: ExpressionContainer.Options, parent?: ExpressionContainer, tree?: ITree, name?: string) {
    super(
      tree || (new ExpressionTreeService(options.session, options.source, options.line) as ITree),
      parent,
      undefined,
      { name: name || options.session?.id },
      { disableCache: true },
    );
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

  get path(): string {
    /**
     * 默认实现中，path 是通过 name 进行组装
     * 而在调试场景中，为了保证每个节点的唯一性，需要为每个节点指定唯一的 path 值
     * 故这里使用 id 作为 path 值
     */
    return String(this.id);
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
    super(options, parent, undefined, options.name);
    this._name = options.name;
  }
}

export class DebugVariable extends ExpressionNode {
  constructor(
    public readonly session: DebugSession | undefined,
    /**
     * https://code.visualstudio.com/updates/v1_49#_contributable-context-menu-for-variables-view
     */
    public readonly variable: DebugProtocol.Variable & { __vscodeVariableMenuContext?: string },
    parent?: ExpressionContainer,
  ) {
    super(
      {
        session,
        variablesReference: variable.variablesReference,
        namedVariables: variable.namedVariables,
        indexedVariables: variable.indexedVariables,
      },
      parent,
    );
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get variableMenuContext(): string {
    return this.variable.__vscodeVariableMenuContext || '';
  }

  toDebugProtocolObject(): DebugProtocol.Variable {
    return {
      name: this.name,
      variablesReference: this.variable.variablesReference || 0,
      value: this.value,
      evaluateName: this.evaluateName,
    };
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
    return String(this.id);
  }

  get evaluateName(): string {
    return this.variable?.evaluateName || '';
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
    if (!this.session || this.session.terminated) {
      return;
    }
    const { name, parent } = this;
    const variablesReference = (parent as DebugScope).variablesReference;
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

  public getRawScope(): DebugProtocol.Scope | undefined {
    let parent = this.parent;
    while (parent !== undefined && !(parent instanceof DebugScope)) {
      parent = parent?.parent;
    }
    return parent!.getRawScope();
  }
}

export class DebugVariableContainer extends ExpressionContainer {
  static BOOLEAN_REGEX = /^true|false$/i;
  static STRING_REGEX = /^(['"]).*\1$/;

  constructor(
    public readonly session: DebugSession | undefined,
    public readonly variable: DebugProtocol.Variable & { __vscodeVariableMenuContext?: string },
    parent: ExpressionContainer | undefined,
    source?: DebugProtocol.Source,
    line?: string | number,
  ) {
    super(
      {
        session,
        variablesReference: variable.variablesReference,
        namedVariables: variable.namedVariables,
        indexedVariables: variable.indexedVariables,
        source,
        line,
      },
      parent,
      undefined,
      variable?.name ||
        (variable.evaluateName
          ? /\["(.+)"]/.exec(variable.evaluateName)
            ? /\["(.+)"]/.exec(variable.evaluateName)![1]
            : variable.evaluateName.split('.')[variable.evaluateName.split('.').length - 1]
          : ''),
    );
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get variableMenuContext(): string {
    return this.variable.__vscodeVariableMenuContext || '';
  }

  toDebugProtocolObject(): DebugProtocol.Variable {
    return {
      name: this.name,
      variablesReference: this.variable.variablesReference || 0,
      value: this.value,
      evaluateName: this.evaluateName,
    };
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
    return String(this.id);
  }

  get evaluateName(): string {
    return this.variable?.evaluateName || '';
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
    if (!this.session || this.session.terminated) {
      return;
    }
    const { name, parent } = this;
    if (!parent) {
      return;
    }
    const variablesReference = (parent as DebugScope).variablesReference;
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

  public getRawScope(): DebugProtocol.Scope | undefined {
    let parent = this.parent;
    while (parent !== undefined && !(parent instanceof DebugScope)) {
      parent = parent?.parent;
    }
    return parent!.getRawScope();
  }
}

export class DebugScope extends ExpressionContainer {
  constructor(
    protected readonly raw: DebugProtocol.Scope,
    protected readonly session: DebugSession,
    parent?: ExpressionContainer,
  ) {
    super(
      {
        session,
        variablesReference: raw.variablesReference,
        namedVariables: raw.namedVariables,
        indexedVariables: raw.indexedVariables,
      },
      parent,
      undefined,
      raw.name,
    );
  }

  public getRawScope(): DebugProtocol.Scope {
    return this.raw;
  }

  public range(): IRange | undefined {
    const rs = this.getRawScope();
    return rs.line && rs.column && rs.endLine && rs.endColumn
      ? new Range(rs.line, rs.column, rs.endLine, rs.endColumn)
      : undefined;
  }
}

export class DebugWatchNode extends ExpressionContainer {
  static notAvailable = localize('debug.watch.notAvailable');

  static is(node?: any): node is DebugWatchNode {
    return !!node && !!(node as DebugWatchNode).expression;
  }

  private _description: string;
  private _available: boolean;
  private raw: DebugProtocol.EvaluateResponse['body'];

  constructor(
    public readonly session: DebugSession | undefined,
    public readonly expression: string,
    parent: ExpressionContainer | undefined,
  ) {
    super(
      {
        session,
      },
      parent,
      undefined,
      expression,
    );
  }

  get description() {
    return this._available ? this._description : DebugWatchNode.notAvailable;
  }

  get available() {
    return this._available;
  }

  public getRawWatch(): DebugProtocol.EvaluateResponse['body'] {
    return this.raw;
  }

  async evaluate(context = 'watch'): Promise<void> {
    if (this.session) {
      try {
        const { expression } = this;
        const body = await this.session.evaluate(expression, context);
        if (body) {
          this.name = this.expression;
          this._description = body.result;
          this._available = true;
          this.variablesReference = body.variablesReference;
          this.namedVariables = body.namedVariables;
          this.indexedVariables = body.indexedVariables;
          this.raw = body;
        }
      } catch (err) {
        this.name = this.expression;
        this._description = err.message;
      }
    } else {
      this.name = this.expression;
      this._available = false;
    }
  }

  async getClipboardValue() {
    if (this.session && this.session.capabilities.supportsValueFormattingOptions) {
      try {
        const { expression } = this;
        const body = await this.session.evaluate(expression, 'clipboard');
        if (body) {
          return body.result;
        }
      } catch (err) {
        return '';
      }
    } else {
      return this._description;
    }
  }
}

export class DebugConsoleVariableContainer extends DebugVariableContainer {
  static is(node?: any): node is DebugConsoleVariableContainer {
    return !!node && (node as DebugConsoleVariableContainer).uniqueID === DebugConsoleVariableContainer.uniqueID;
  }

  static uniqueID = 'DebugConsoleVariable';

  get uniqueID() {
    return DebugConsoleVariableContainer.uniqueID;
  }

  get description() {
    if (this.variable) {
      return this.variable.value;
    }
    return '';
  }

  get tooltip() {
    if (this.variable) {
      return this.variable.value;
    }
    return '';
  }
}

export class DebugConsoleNode extends ExpressionContainer {
  static is(node?: any): node is DebugConsoleNode {
    return !!node && !!(node as DebugConsoleNode).expression;
  }

  private _available: boolean;
  private _description: string;

  get available() {
    return this._available;
  }

  constructor(
    public readonly session: DebugSession | undefined,
    public readonly expression: string,
    parent: ExpressionContainer | undefined,
  ) {
    super(
      {
        session,
      },
      parent,
      undefined,
      expression,
    );
  }

  get description() {
    return this._description;
  }

  async evaluate(context = 'repl'): Promise<void> {
    const { expression } = this;
    if (this.session) {
      try {
        if (typeof expression === 'string') {
          const body = await this.session.evaluate(expression, context);
          if (body) {
            this.name = expression;
            this._description = body.result;
            this.variablesReference = body.variablesReference;
            this.namedVariables = body.namedVariables;
            this.indexedVariables = body.indexedVariables;
            this._available = true;
          }
        }
      } catch (err) {
        this._available = false;
        this.name = expression;
        this._description = err.message;
      }
    } else {
      this._available = false;
      this.name = expression;
    }
  }
}

export class DebugConsoleRoot extends ExpressionContainer {
  static is(node?: ExpressionContainer): node is DebugConsoleRoot {
    return !!node && !node.parent;
  }

  constructor(public readonly session: DebugSession | undefined, presets: DebugConsoleNode[] = []) {
    super({ session }, undefined, new DebugConsoleTreeService(session) as ITree);
    this.presetChildren = presets;
  }

  get expanded() {
    return true;
  }

  updatePresetChildren(presets: (AnsiConsoleNode | DebugConsoleNode | DebugVariableContainer)[]) {
    this.presetChildren = presets as (ExpressionNode | ExpressionContainer)[];
  }
}

export class DebugWatchRoot extends ExpressionContainer {
  static is(node?: ExpressionContainer): node is DebugWatchRoot {
    return !!node && !node.parent;
  }

  constructor(public readonly session: DebugSession | undefined, presets: DebugWatchNode[] = []) {
    super({ session }, undefined);
    this.presetChildren = presets;
  }

  get expanded() {
    return true;
  }

  updatePresetChildren(presets: DebugWatchNode[]) {
    this.presetChildren = presets;
  }
}

export class DebugVariableRoot extends DebugVariableContainer {
  static is(node?: ExpressionContainer): node is DebugVariableRoot {
    return !!node && !node.parent;
  }

  constructor(public readonly session: DebugSession | undefined) {
    super(session, {} as any, undefined);
  }

  get expanded() {
    return true;
  }
}

export class DebugHoverVariableRoot extends ExpressionContainer {
  private _value = '';

  constructor(protected readonly expression: string, protected readonly session: DebugSession | undefined) {
    super({ session });
  }

  get name() {
    return this._value;
  }

  protected _available = false;
  get available(): boolean {
    return this._available;
  }

  async evaluate(context = 'repl'): Promise<void> {
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
