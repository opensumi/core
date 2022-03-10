import throttle = require('lodash.throttle');

import { DisposableCollection, Emitter, Event, IReporterService } from '@opensumi/ide-core-browser';

import { DEBUG_REPORT_NAME } from '../../common';
import { DEBUG_COMMANDS } from '../debug-contribution';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugWatchRoot, DebugWatchNode } from '../tree/debug-tree-node.define';

export const IDebugWatchData = Symbol('IDebugWatchData');
export interface IDebugWatchData {
  getRoot: () => Promise<DebugWatchRoot | void>;
  updateWatchExpressions: (data: string[]) => Promise<void>;
  addWatchExpression: (value: string) => void;
  clear: () => Promise<void>;
  onDidChange: Event<void>;
  onDidVariableChange: Event<void>;
  onDidExpressionChange: Event<string[]>;
}

export class DebugWatch implements IDebugWatchData {
  protected readonly toDispose = new DisposableCollection();

  protected fireDidChange: () => void = throttle(() => this.onDidChangeEmitter.fire(), 50);
  protected fireVariableChange: () => void = throttle(() => this.onDidVariableChangeEmitter.fire(), 50);
  protected fireExpressionChange: (expressions: string[]) => void = throttle(
    (expressions: string[]) => this.onDidExExpressionChangeEmitter.fire(expressions),
    50,
  );

  private _expressions: string[] = [];
  private _root: DebugWatchRoot;

  whenReady: Promise<any>;

  private onDidChangeEmitter: Emitter<void> = new Emitter();
  private onDidVariableChangeEmitter: Emitter<void> = new Emitter();
  private onDidExExpressionChangeEmitter: Emitter<string[]> = new Emitter();

  constructor(private readonly manager: DebugSessionManager, private readonly reporterService: IReporterService) {
    this.whenReady = this.init();
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  get onDidVariableChange(): Event<void> {
    return this.onDidVariableChangeEmitter.event;
  }

  get onDidExpressionChange(): Event<string[]> {
    return this.onDidExExpressionChangeEmitter.event;
  }

  async getRoot() {
    const presets: DebugWatchNode[] = [];
    const root = new DebugWatchRoot(this.manager.currentSession);
    for (const expression of this._expressions) {
      const node = new DebugWatchNode(this.manager.currentSession, expression, root);
      // 执行运算以获取节点信息
      await node.evaluate();
      presets.push(node);
    }
    root.updatePresetChildren(presets);
    this._root = root;
    return this._root;
  }

  async init() {
    this.toDispose.push(
      this.manager.onDidStopDebugSession(() => {
        this.fireDidChange();
      }),
    );
    this.toDispose.push(
      this.manager.onDidDestroyDebugSession(() => {
        this.fireDidChange();
      }),
    );
    this.toDispose.push(
      this.manager.onDidChangeActiveDebugSession(() => {
        const session = this.manager.currentSession;
        if (session) {
          session.onVariableChange(() => {
            this.fireVariableChange();
          });
          session.onDidChangeCallStack(() => {
            this.fireVariableChange();
          });
        }
      }),
    );
  }

  async clear() {
    this.updateWatchExpressions([]);
    this.fireExpressionChange([]);
    this.fireDidChange();
  }

  async updateWatchExpressions(data: string[]) {
    this._expressions = data;
  }

  addWatchExpression(value: string) {
    this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_WATCH, DEBUG_COMMANDS.ADD_WATCHER.id, { value });
    const index = this._expressions.indexOf(value);
    if (index === -1) {
      this._expressions.push(value);
      this.fireExpressionChange(this._expressions);
    }
  }

  renameWatchExpression(value: string, newValue: string) {
    const index = this._expressions.indexOf(value);
    if (index >= 0) {
      this._expressions.splice(index, 1, newValue);
    }
    this.fireExpressionChange(this._expressions);
  }

  removeWatchExpression(value: string) {
    const index = this._expressions.indexOf(value);
    if (index >= 0) {
      this._expressions.splice(index, 1);
    }
    this.fireExpressionChange(this._expressions);
  }
}
