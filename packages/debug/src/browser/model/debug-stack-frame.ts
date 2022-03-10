import { IRange } from '@opensumi/ide-core-browser';
import { IResourceOpenOptions } from '@opensumi/ide-editor';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { DebugSession } from '../debug-session';
import { DebugScope, ExpressionContainer } from '../tree/debug-tree-node.define';

import { DebugSource } from './debug-source';
import { DebugThread } from './debug-thread';


export class DebugStackFrameData {
  readonly raw: DebugProtocol.StackFrame;
}

export class DebugStackFrame extends DebugStackFrameData {
  constructor(readonly thread: DebugThread, readonly session: DebugSession) {
    super();
  }

  get id(): string {
    return this.session.id + ':' + this.thread.id + ':' + this.raw.id;
  }

  protected _source: DebugSource | undefined;
  get source(): DebugSource | undefined {
    return this._source;
  }
  update(data: Partial<DebugStackFrameData>): void {
    Object.assign(this, data);
    this._source = this.raw.source && this.session.getSource(this.raw.source);
  }

  async restart(): Promise<DebugProtocol.RestartFrameResponse | undefined> {
    if (this.session.capabilities.supportsRestartFrame) {
      return await this.session.sendRequest('restartFrame', { frameId: this.raw.id });
    }
    return Promise.reject(new Error('restartFrame not supported'));
  }

  get canRestart(): boolean {
    return typeof this.raw.canRestart === 'boolean' ? this.raw.canRestart : true;
  }

  async open(options?: IResourceOpenOptions) {
    if (!this.source) {
      return;
    }
    const { line, column, endLine, endColumn } = this.raw;
    let range: IRange = {
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: Infinity,
    };
    if (typeof endLine === 'number') {
      range = {
        ...range,
        endLineNumber: endLine,
        endColumn: typeof endColumn === 'number' ? endColumn : Infinity,
      };
    }
    this.source.open({
      ...options,
      range,
    });
  }

  protected toArgs<T extends object>(arg?: T): { frameId: number } & T {
    return Object.assign({}, arg, {
      frameId: this.raw.id,
    });
  }

  getScopes(parent?: ExpressionContainer): Promise<DebugScope[]> {
    return this.doGetScopes(parent);
  }
  protected async doGetScopes(parent?: ExpressionContainer): Promise<DebugScope[]> {
    try {
      const response = await this.session.sendRequest('scopes', this.toArgs());
      return response.body.scopes.map((raw) => new DebugScope(raw, this.session, parent));
    } catch (e) {
      return [];
    }
  }

  public range(): IRange {
    const rs = this.raw;
    return new Range(rs.line, rs.column, rs.endLine || rs.line, rs.endColumn || rs.column);
  }

  public async getMostSpecificScopes(range: IRange): Promise<DebugScope[]> {
    const scopes = await this.doGetScopes();
    const nonExpensiveScopes = scopes.filter((s) => !s.getRawScope().expensive);
    const haveRangeInfo = nonExpensiveScopes.some((s) => !!s.range());
    if (!haveRangeInfo) {
      return nonExpensiveScopes;
    }

    const scopesContainingRange = nonExpensiveScopes
      .filter((scope) => scope.range() && Range.containsRange(scope.range()!, range))
      .sort(
        (first, second) =>
          first.range()!.endLineNumber -
          first.range()!.startLineNumber -
          (second.range()!.endLineNumber - second.range()!.startLineNumber),
      );
    return scopesContainingRange.length ? scopesContainingRange : nonExpensiveScopes;
  }
}
