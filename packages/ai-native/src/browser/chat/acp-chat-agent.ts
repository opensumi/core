import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  CancellationToken,
  ChatFeatureRegistryToken,
  Deferred,
  IAIBackService,
  IAIReporter,
  IApplicationService,
  IChatProgress,
  MCPConfigServiceToken,
  URI,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import {
  CoreMessage,
  IChatAgent,
  IChatAgentCommand,
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentService,
  IChatAgentWelcomeMessage,
} from '../../common/index';
import { MCPConfigService } from '../mcp/config/mcp-config.service';

import { ChatFeatureRegistry } from './chat.feature.registry';
import { getAgentConfig, getDefaultAgentType } from './get-default-agent-type';

/**
 * ACP Chat Agent - 实现默认的聊天代理
 */
@Injectable()
export class AcpChatAgent implements IChatAgent {
  static readonly AGENT_ID = 'Default_Chat_Agent';

  @Autowired(IChatAgentService)
  private readonly chatAgentService: IChatAgentService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  @Autowired(MonacoCommandRegistry)
  private readonly monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: ChatFeatureRegistry;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  public id = AcpChatAgent.AGENT_ID;

  public get metadata(): IChatAgentMetadata {
    return {
      systemPrompt: this.preferenceService.get<string>(AINativeSettingSectionsId.SystemPrompt, ''),
    };
  }

  public set metadata(_) {
    // 不处理
  }

  private async getRequestOptions() {
    const model = this.preferenceService.get<string>(AINativeSettingSectionsId.LLMModelSelection);
    const modelId = this.preferenceService.get<string>(AINativeSettingSectionsId.ModelID);
    let apiKey: string = '';
    let baseURL: string = '';
    if (model === 'deepseek') {
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.DeepseekApiKey, '');
    } else if (model === 'openai') {
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
    } else if (model === 'anthropic') {
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.AnthropicApiKey, '');
    } else {
      // openai-compatible 为兜底
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
      baseURL = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiBaseURL, '');
    }
    const maxTokens = this.preferenceService.get<number>(AINativeSettingSectionsId.MaxTokens);
    const agent = this.chatAgentService.getAgent(AcpChatAgent.AGENT_ID);
    const disabledTools = await this.mcpConfigService.getDisabledTools();

    return {
      clientId: this.applicationService.clientId,
      model,
      modelId,
      apiKey,
      baseURL,
      maxTokens,
      system: agent?.metadata.systemPrompt,
      disabledTools,
    };
  }

  async invoke(
    request: IChatAgentRequest,
    progress: (part: IChatProgress) => void,
    history: CoreMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult> {
    const chatDeferred = new Deferred<void>();
    const { message, command } = request;
    let prompt: string = message;
    if (command) {
      const commandHandler = this.chatFeatureRegistry.getSlashCommandHandler(command);
      if (commandHandler && commandHandler.providerPrompt) {
        const editor = this.monacoCommandRegistry.getActiveCodeEditor();
        const slashCommandPrompt = await commandHandler.providerPrompt(message, editor);
        prompt = slashCommandPrompt;
      }
    }

    // Slash command 自定义路由：handler 有 invoke 时跳过 ACP，由 handler 自行处理
    if (command) {
      const commandHandler = this.chatFeatureRegistry.getSlashCommandHandler(command);
      if (commandHandler?.invoke) {
        await commandHandler.invoke(prompt, progress, token);
        chatDeferred.resolve();
        return {};
      }
    }

    let sessionId = request.sessionId;
    // 去掉 acp: 前缀（Agent 使用纯 UUID）
    if (sessionId.startsWith('acp:')) {
      // 【优化】等待后台 ACP Session 初始化完成
      // createSession 时已经异步初始化，正常情况下应该立即可用
      sessionId = sessionId.substring(4);
    }
    // agent 模式只需要发送最后一条数据
    const lastmessage = history[history.length - 1];

    try {
      await this.workspaceService.whenReady;
      const stream = await this.aiBackService.requestStream(
        prompt,
        {
          requestId: request.requestId,
          sessionId,
          history: [lastmessage],
          images: request.images,
          ...(await this.getRequestOptions()),
          agentSessionConfig: (() => {
            const agentType = getDefaultAgentType(this.preferenceService);
            const agentConfig = getAgentConfig(this.preferenceService, agentType);
            return {
              ...agentConfig,
              workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
            };
          })(),
        },
        token,
      );

      listenReadable<IChatProgress>(stream, {
        onData: (data) => {
          progress(data);
        },
        onEnd: () => {
          chatDeferred.resolve();
        },
        onError: (error) => {
          this.messageService.error(error.message);
          this.aiReporter.end(sessionId + '_' + request.requestId, {
            message: error.message,
            success: false,
            command,
          });
          chatDeferred.reject(error);
        },
      });

      await chatDeferred.promise;
    } catch (e) {
      this.messageService.error(e.message);
      chatDeferred.reject(e);
    }
    return {};
  }

  async provideSlashCommands(): Promise<IChatAgentCommand[]> {
    return this.chatFeatureRegistry
      .getAllSlashCommand()
      .map((s) => ({ ...s, name: s.name, description: s.description || '' }));
  }

  async provideChatWelcomeMessage(): Promise<IChatAgentWelcomeMessage | undefined> {
    return undefined;
  }
}
