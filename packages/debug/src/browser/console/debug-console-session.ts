import { IDebugConsoleSession, CompletionItemKind, IDebugSessionManager } from '../../common';
import { Autowired, Injectable } from '@ali/common-di';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DisposableCollection, Emitter, Event, MessageType, ILogger } from '@ali/ide-core-common';
import { ExpressionContainer, AnsiConsoleItem, ExpressionItem } from './debug-console-items';
import { DebugSession } from '../debug-session';
import throttle = require('lodash.throttle');

@Injectable()
export class DebugConsoleSession implements IDebugConsoleSession {

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  @Autowired(ILogger)
  logger: ILogger;

  protected readonly completionKinds = new Map<DebugProtocol.CompletionItemType | undefined, CompletionItemKind>();

  protected readonly toDispose = new DisposableCollection();

  protected fireDidChange: any = throttle(() => this.onDidChangeEmitter.fire(), 50);

  private nodes: any[];

  onDidChangeEmitter: Emitter<void> = new Emitter();

  constructor() {
    this.init();
  }

  async init() {
    this.toDispose.push(this.manager.onDidCreateDebugSession((session) => {
      if (this.manager.sessions.length === 1) {
        this.clear();
      }
      session.on('output', (event) => this.logOutput(session, event));
    }));
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  getChildren(): any[] {
    return this.nodes;
  }

  clear(): void {
    this.nodes = [];
    this.fireDidChange();
  }

  protected async logOutput(session: DebugSession, event: DebugProtocol.OutputEvent): Promise<void> {
    const body = event.body;
    const { category, variablesReference } = body;
    if (category === 'telemetry') {
        this.logger.debug(`telemetry/${event.body.output}`, event.body.data);
        return;
    }
    const severity = category === 'stderr' ? MessageType.Error : event.body.category === 'console' ? MessageType.Warning : MessageType.Info;
    if (variablesReference) {
        const items = await new ExpressionContainer({ session, variablesReference }).getChildren();
        this.nodes.push(...items);
    } else if (typeof body.output === 'string') {
        for (const line of body.output.split('\n')) {
            this.nodes.push(new AnsiConsoleItem(line, severity));
        }
    }
    this.fireDidChange();
  }

  async execute(value: string): Promise<void> {
    const expression = new ExpressionItem(value, this.manager.currentSession);
    this.nodes.push(expression);
    await expression.evaluate();
    this.fireDidChange();
  }
}
