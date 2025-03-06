import flatMap from 'lodash/flatMap';

import { Autowired, Injectable } from '@opensumi/di';
import {
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancellationToken,
  ChatFeatureRegistryToken,
  ChatServiceToken,
  Disposable,
  Emitter,
  IAIReporter,
  IChatProgress,
  IDisposable,
  ILogger,
  toDisposable,
} from '@opensumi/ide-core-common';

import {
  CoreMessage,
  IChatAgent,
  IChatAgentCommand,
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentService,
  IChatFollowup,
  IChatMessageStructure,
} from '../../common';
import { LLMContextService, LLMContextServiceToken } from '../../common/llm-context';
import { ChatAgentPromptProvider } from '../../common/prompts/context-prompt-provider';
import { IChatFeatureRegistry } from '../types';

import { ChatService } from './chat.api.service';

@Injectable()
export class ChatAgentService extends Disposable implements IChatAgentService {
  private readonly agents = new Map<string, { agent: IChatAgent; commands: IChatAgentCommand[] }>();

  private defaultAgentId: string | undefined;

  private initialUserMessageMap: Map<string, string> = new Map();

  private shouldUpdateContext = false;

  private contextVersion: number;

  private readonly _onDidChangeAgents = new Emitter<void>();
  readonly onDidChangeAgents = this._onDidChangeAgents.event;

  private readonly _onDidSendMessage = new Emitter<IChatProgress>();
  public readonly onDidSendMessage = this._onDidSendMessage.event;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(LLMContextServiceToken)
  protected readonly contextService: LLMContextService;

  @Autowired(ChatAgentPromptProvider)
  protected readonly promptProvider: ChatAgentPromptProvider;

  @Autowired(ChatServiceToken)
  private aiChatService: ChatService;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: IChatFeatureRegistry;

  constructor() {
    super();
    this.addDispose(this._onDidChangeAgents);
    this.addDispose(
      this.contextService.onDidContextFilesChangeEvent((event) => {
        if (event.version !== this.contextVersion) {
          this.contextVersion = event.version;
          this.shouldUpdateContext = true;
        }
      }),
    );
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

  async updateAgent(id: string, updateMetadata: IChatAgentMetadata) {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id} registered`);
    }
    data.agent.metadata = { ...data.agent.metadata, ...updateMetadata };
    data.commands = await data.agent.provideSlashCommands(CancellationToken.None);

    if (updateMetadata.isDefault) {
      this.defaultAgentId = id;
    }

    const chatWelcomeMessage = await data.agent.provideChatWelcomeMessage(CancellationToken.None);

    if (chatWelcomeMessage) {
      const { content, sampleQuestions } = chatWelcomeMessage;
      this.chatFeatureRegistry.registerWelcome(content, sampleQuestions as any);
    }

    this._onDidChangeAgents.fire();
  }

  getAgents(): Array<IChatAgent> {
    return Array.from(this.agents.values(), (v) => v.agent);
  }

  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  getDefaultAgentId() {
    return this.defaultAgentId;
  }

  getAgent(id: string): IChatAgent | undefined {
    const data = this.agents.get(id);
    return data?.agent;
  }

  async invokeAgent(
    id: string,
    request: IChatAgentRequest,
    progress: (part: IChatProgress) => void,
    history: CoreMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult> {
    const data = this.agents.get(id);
    if (!data) {
      throw new Error(`No agent with id ${id}`);
    }

    // 发送第一条消息时携带初始 context
    if (!this.initialUserMessageMap.has(request.sessionId)) {
      this.initialUserMessageMap.set(request.sessionId, request.message);
      const rawMessage = request.message;
      request.message = this.provideContextMessage(rawMessage, request.sessionId);
    } else if (this.shouldUpdateContext || request.regenerate || history.length === 0) {
      request.message = this.provideContextMessage(request.message, request.sessionId);
      this.shouldUpdateContext = false;
    }

    const result = await data.agent.invoke(request, progress, history, token);
    return result;
  }

  private provideContextMessage(message: string, sessionId: string) {
    const context = this.contextService.serialize();
    const fullMessage = this.promptProvider.provideContextPrompt(context, message);
    this.aiReporter.send({
      msgType: AIServiceType.Chat,
      actionType: ActionTypeEnum.ContextEnhance,
      actionSource: ActionSourceEnum.Chat,
      sessionId,
      message: fullMessage,
    });
    return fullMessage;
  }

  populateChatInput(id: string, message: IChatMessageStructure) {
    this.aiChatService.sendMessage({
      ...message,
      agentId: id,
      immediate: false,
    });
  }

  getCommands() {
    return flatMap(
      Array.from(this.agents.values(), ({ agent, commands }) => commands.map((c) => ({ ...c, agentId: agent.id }))),
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

  sendMessage(chunk: IChatProgress): void {
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
