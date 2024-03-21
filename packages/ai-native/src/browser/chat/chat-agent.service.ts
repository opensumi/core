import flatMap from 'lodash/flatMap';

import { Autowired, Injectable } from '@opensumi/di';
import { CancellationToken, Disposable, Emitter, IDisposable, ILogger, toDisposable } from '@opensumi/ide-core-common';

import {
  IAIChatService,
  IChatAgent,
  IChatAgentCommand,
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentService,
  IChatContent,
  IChatFollowup,
  IChatMessage,
  IChatMessageStructure,
  IChatProgress,
} from '../../common';

import { ChatService } from './chat.service';

@Injectable()
export class ChatAgentService extends Disposable implements IChatAgentService {
  private readonly agents = new Map<string, { agent: IChatAgent; commands: IChatAgentCommand[] }>();

  private readonly _onDidChangeAgents = new Emitter<void>();
  readonly onDidChangeAgents = this._onDidChangeAgents.event;

  private readonly _onDidSendMessage = new Emitter<IChatContent>();
  public readonly onDidSendMessage = this._onDidSendMessage.event;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IAIChatService)
  aiChatService: ChatService;

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
    progress: (part: IChatProgress) => void,
    history: IChatMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult> {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id}`);
    }

    const result = await data.agent.invoke(request, progress, history, token);
    return result;
  }

  populateChatInput(id: string, message: IChatMessageStructure) {
    this.aiChatService.launchChatMessage({
      ...message,
      agentId: id,
      immediate: false,
    });
  }

  getCommands() {
    return flatMap(
      Array.from(this.agents.values(), ({ agent, commands }) => commands.map((c) => ({ agentId: agent.id, ...c }))),
    );
  }

  async getFollowups(id: string, sessionId: string, token: CancellationToken): Promise<IChatFollowup[]> {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id}`);
    }

    if (!data.agent.provideFollowups) {
      return [];
    }

    return data.agent.provideFollowups(sessionId, token);
  }

  async getSampleQuestions(id: string, token: CancellationToken) {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id}`);
    }

    if (!data.agent.provideSampleQuestions) {
      return [];
    }

    return data.agent.provideSampleQuestions(token);
  }

  async getAllSampleQuestions() {
    const result = await Promise.all(
      Array.from(this.agents.values()).map(async ({ agent }) => {
        try {
          return await this.getSampleQuestions(agent.id, CancellationToken.None);
        } catch (err) {
          this.logger.error(err);
          return [];
        }
      }),
    );
    return flatMap(result);
  }

  sendMessage(chunk: IChatContent): void {
    this._onDidSendMessage.fire(chunk);
  }

  parseMessage(value: string, currentAgentId?: string) {
    const parsedInfo = {
      agentId: '',
      command: '',
      message: value,
    };
    let useAgentId = currentAgentId;
    const agents = this.getAgents();
    const agentIdReg = new RegExp(`^@(${agents.map((a) => a.id).join('|')})(?:\\s+|$)`, 'i');
    const agentIdMatch = parsedInfo.message.match(agentIdReg);
    if (agentIdMatch) {
      const matchedAgent = agents.find((a) => a.id.toLowerCase() === agentIdMatch[1].toLowerCase());
      if (!matchedAgent) {
        return parsedInfo;
      }
      useAgentId = matchedAgent.id;
      parsedInfo.agentId = useAgentId;
      parsedInfo.message = parsedInfo.message.replace(agentIdMatch[0], '');
    }
    if (useAgentId) {
      const commands = this.agents.get(useAgentId)?.commands;
      if (commands?.length) {
        const commandReg = new RegExp(`^/\\s?(${commands.map((c) => c.name).join('|')})(?:\\s+|$)`, 'i');
        const commandMatch = parsedInfo.message.match(commandReg);
        if (commandMatch) {
          const matchedCommand = commands.find((c) => c.name.toLowerCase() === commandMatch[1].toLowerCase());
          if (!matchedCommand) {
            return parsedInfo;
          }
          parsedInfo.command = matchedCommand.name;
          parsedInfo.message = parsedInfo.message.replace(commandMatch[0], '');
        }
      }
    }
    return parsedInfo;
  }
}
