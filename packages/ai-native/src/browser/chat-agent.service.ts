import { flatMap } from 'lodash';

import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, Disposable, Emitter, toDisposable, CancellationToken } from '@opensumi/ide-core-common';

import {
  IChatAgent,
  IChatAgentService,
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatMessage,
  IChatProgress,
  IChatAgentResult,
  IChatAgentCommand,
} from '../common';

import { MsgStreamManager } from './model/msg-stream-manager';

@Injectable()
export class ChatAgentService extends Disposable implements IChatAgentService {
  private readonly agents = new Map<string, { agent: IChatAgent; commands: IChatAgentCommand[] }>();

  private readonly _onDidChangeAgents = new Emitter<void>();
  readonly onDidChangeAgents = this._onDidChangeAgents.event;

  @Autowired(MsgStreamManager)
  private readonly msgStreamManager: MsgStreamManager;

  constructor() {
    super();
    this.addDispose(this._onDidChangeAgents);
  }

  registerAgent(agent: IChatAgent): IDisposable {
    if (this.agents.has(agent.id)) {
      throw new Error(`Already registered an agent with id ${agent.id}`);
    }
    this.agents.set(agent.id, { agent, commands: [] });
    this._onDidChangeAgents.fire();

    return toDisposable(() => {
      if (this.agents.delete(agent.id)) {
        this._onDidChangeAgents.fire();
      }
    });
  }

  updateAgent(id: string, updateMetadata: IChatAgentMetadata): void {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id} registered`);
    }
    data.agent.metadata = { ...data.agent.metadata, ...updateMetadata };
    data.agent.provideSlashCommands(CancellationToken.None).then((commands) => {
      data.commands = commands;
    });
    this._onDidChangeAgents.fire();
  }

  getAgents(): Array<IChatAgent> {
    return Array.from(this.agents.values(), (v) => v.agent);
  }

  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  getAgent(id: string): IChatAgent | undefined {
    const data = this.agents.get(id);
    return data?.agent;
  }

  async invokeAgent(
    id: string,
    request: IChatAgentRequest,
    history: IChatMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult> {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id}`);
    }

    this.msgStreamManager.setCurrentSessionId(request.requestId);
    this.msgStreamManager.sendThinkingStatue();

    const progress = (data: IChatProgress) => {
      this.msgStreamManager.recordMessage(request.sessionId, {
        delta: {
          content: data.content,
          role: 'agent',
        },
        finish_reason: null,
        index: 0,
      });
    };

    const result = await data.agent.invoke(request, progress, history, token);
    this.msgStreamManager.recordMessage(request.sessionId, {
      delta: {
        content: '',
        role: 'agent',
      },
      finish_reason: 'stop',
      index: 0,
    });
    return result;
  }

  getCommands() {
    return flatMap(
      Array.from(this.agents.values(), ({ agent, commands }) => commands.map((c) => ({ agentId: agent.id, ...c }))),
    );
  }
}
