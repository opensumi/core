import { IDebugSessionManager } from '../../common';
import { Autowired, Injectable } from '@ali/common-di';
import { DebugSessionManager } from '../debug-session-manager';
import { DisposableCollection, Emitter, Event, ILogger, TreeNode } from '@ali/ide-core-common';
import { ExpressionWatchItem } from '../console/debug-console-items';
import throttle = require('lodash.throttle');

export class DebugWatchData {
  getChildren: () => Promise<TreeNode[]>;
  execute: (value: string) => Promise<void>;
  clear: () => void;
}

@Injectable()
export class DebugWatch implements DebugWatchData {

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  @Autowired(ILogger)
  logger: ILogger;

  protected readonly toDispose = new DisposableCollection();

  protected fireDidChange: any = throttle(() => this.onDidChangeEmitter.fire(), 50);

  private nodes: any[] = [];

  onDidChangeEmitter: Emitter<void> = new Emitter();

  constructor() {
    this.init();
  }

  async init() {
    this.toDispose.push(this.manager.onDidStopDebugSession((session) => {
      this.fireDidChange();
    }));
    this.toDispose.push(this.manager.onDidDestroyDebugSession((session) => {
      this.fireDidChange();
    }));
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  async getChildren(): Promise<TreeNode[]> {
    const childs: any = [];
    for (const node of this.nodes) {
      const expression = new ExpressionWatchItem(node.expression, this.manager.currentSession);
      await expression.evaluate();
      childs.push(expression);
    }
    return childs;
  }

  clear(): void {
    this.nodes = [];
    this.fireDidChange();
  }

  async execute(value: string): Promise<void> {
    const expression = new ExpressionWatchItem(value, this.manager.currentSession);
    this.nodes.push(expression);
    await expression.evaluate();
    this.fireDidChange();
  }
}
