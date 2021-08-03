import { Autowired, Injectable, Optional } from '@ali/common-di';
import { DebugProtocol } from '@ali/vscode-debugprotocol/lib/debugProtocol';
import { DisposableCollection, Emitter, Event, MessageType, ILogger } from '@ali/ide-core-common';
import { ExpressionContainer, AnsiConsoleNode, DebugConsoleNode, DebugVariableContainer } from '../../tree';
import { DebugSession } from '../../debug-session';
import throttle = require('lodash.throttle');
import { DebugConsoleTreeModel } from './debug-console-model';
import { LinkDetector } from '../../debug-link-detector';

type ConsoleNodes = DebugConsoleNode | AnsiConsoleNode | DebugVariableContainer;

@Injectable({ multiple: true})
export class DebugConsoleSession {

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(LinkDetector)
  private linkDetector: LinkDetector;

  // 缓冲未完成的append进来的内容
  protected uncompletedItemContent: string | undefined;

  protected readonly toDispose = new DisposableCollection();

  protected fireDidChange: any = throttle(() => this.onDidChangeEmitter.fire(), 50);

  private onDidChangeEmitter: Emitter<void> = new Emitter();

  constructor(@Optional() private session: DebugSession, @Optional() private treeModel: DebugConsoleTreeModel) {
    this.init();
  }

  /**
   * 这里需要将 tree 的 children 做扁平处理
   * 因为当用户在控制台输入表达式求值时，得到的结果如果是对象，也需要把这个对象的 children 给扔到 DebugConsoleRoot.updatePresetChildren 方法里去
   * 否则会出现，对象展开的状态下，有新的日志内容发送过来时，对象的所有子属性都消失的情况，
   */
  resolveChildren() {
    const flattenedBranch = this.treeModel.root.flattenedBranch || [];
    return flattenedBranch.map((id: number) => this.treeModel.root.getTreeNodeById(id)) as ConsoleNodes[];
  }

  async init() {
    this.session.on('output', (event) => this.logOutput(this.session, event));
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  clear(): void {
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
          this.treeModel.root.insertItem(child as DebugConsoleNode);
        }
      }
    } else if (typeof body.output === 'string') {
      for (const content of body.output.split('\n')) {
        if (!!content) {
          this.treeModel.root.insertItem(new AnsiConsoleNode(content, this.treeModel?.root, this.linkDetector, severity, source, line));
        }
      }
    }
    this.fireDidChange();
  }

  async execute(value: string): Promise<void> {
    this.treeModel.root.insertItem(new AnsiConsoleNode(value, this.treeModel.root, this.linkDetector, MessageType.Info));
    const expression = new DebugConsoleNode(this.session, value, this.treeModel?.root as ExpressionContainer);
    this.treeModel.root.insertItem(expression);
    this.fireDidChange();
  }

  append(value: string): void {
    if (!value) {
      return;
    }

    const lastItem = this.resolveChildren().slice(-1)[0];
    if (lastItem instanceof AnsiConsoleNode && lastItem.description === this.uncompletedItemContent) {
      this.resolveChildren().pop();
      this.uncompletedItemContent += value;
    } else {
      this.uncompletedItemContent = value;
    }

    this.treeModel.root.insertItem(new AnsiConsoleNode(this.uncompletedItemContent, this.treeModel?.root, this.linkDetector, MessageType.Info));
    this.fireDidChange();
  }

  appendLine(value: string): void {
    this.treeModel.root.insertItem(new AnsiConsoleNode(value, this.treeModel?.root, this.linkDetector, MessageType.Info));
    this.fireDidChange();
  }
}
