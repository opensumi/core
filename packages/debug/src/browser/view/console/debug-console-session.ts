import { CompletionItemKind } from '../../../common';
import { Autowired, Injectable, Optional } from '@ali/common-di';
import { DebugProtocol } from '@ali/vscode-debugprotocol/lib/debugProtocol';
import { DisposableCollection, Emitter, Event, MessageType, ILogger } from '@ali/ide-core-common';
import { ExpressionContainer, AnsiConsoleNode, DebugConsoleNode, DebugVariableContainer } from '../../tree';
import { DebugSession } from '../../debug-session';
import throttle = require('lodash.throttle');
import { DebugConsoleTreeModel } from './debug-console-model';

@Injectable({ multiple: true})
export class DebugConsoleSession {

  @Autowired(ILogger)
  private logger: ILogger;

  // 缓冲未完成的append进来的内容
  protected uncompletedItemContent: string | undefined;

  protected readonly completionKinds = new Map<DebugProtocol.CompletionItemType | undefined, CompletionItemKind>();

  protected readonly toDispose = new DisposableCollection();

  protected fireDidChange: any = throttle(() => this.onDidChangeEmitter.fire(), 50);

  private nodes: (DebugConsoleNode | AnsiConsoleNode | DebugVariableContainer)[] = [];

  private onDidChangeEmitter: Emitter<void> = new Emitter();

  constructor(@Optional() private session: DebugSession, @Optional() private treeModel: DebugConsoleTreeModel) {
    this.init();
  }

  resolveChildren() {
    return this.nodes;
  }

  async init() {
    this.session.on('output', (event) => this.logOutput(this.session, event));
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  clear(): void {
    this.nodes = [];
    this.fireDidChange();
  }

  protected async logOutput(session: DebugSession, event: DebugProtocol.OutputEvent): Promise<void> {
    const body = event.body;
    const { category, variablesReference, source, line } = body;
    if (!this.treeModel) {
      return ;
    }
    const severity = category === 'stderr' ? MessageType.Error : event.body.category === 'console' ? MessageType.Warning : MessageType.Info;
    if (category === 'telemetry') {
      this.logger.debug(`telemetry/${event.body.output}`, event.body.data);
      return;
    }
    if (variablesReference) {
      const node = new ExpressionContainer({ session, variablesReference, source, line }, this.treeModel?.root as ExpressionContainer);
      await node.hardReloadChildren(true);
      if (node.children) {
        for (const child of node.children) {
          this.nodes.push(child as DebugConsoleNode);
        }
      }
    } else if (typeof body.output === 'string') {
      for (const content of body.output.split('\n')) {
        if (!!content) {
          this.nodes.push(new AnsiConsoleNode(content, this.treeModel?.root, severity, source, line));
        }
      }
    }
    this.fireDidChange();
  }

  async execute(value: string): Promise<void> {
    this.nodes.push(new AnsiConsoleNode(value, this.treeModel.root, MessageType.Info));
    const expression = new DebugConsoleNode(this.session, value, this.treeModel?.root as ExpressionContainer);
    this.nodes.push(expression);
    this.fireDidChange();
  }

  append(value: string): void {
    if (!value) {
      return;
    }

    const lastItem = this.nodes.slice(-1)[0];
    if (lastItem instanceof AnsiConsoleNode && lastItem.description === this.uncompletedItemContent) {
      this.nodes.pop();
      this.uncompletedItemContent += value;
    } else {
      this.uncompletedItemContent = value;
    }

    this.nodes.push(new AnsiConsoleNode(this.uncompletedItemContent, this.treeModel?.root, MessageType.Info));
    this.fireDidChange();
  }

  appendLine(value: string): void {
    this.nodes.push(new AnsiConsoleNode(value, this.treeModel?.root, MessageType.Info));
    this.fireDidChange();
  }
}
