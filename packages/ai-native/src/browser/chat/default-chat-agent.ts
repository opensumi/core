/**
 * DefaultChatAgent - 默认聊天 Agent 实现
 *
 * 作为 AI 后端服务和聊天界面之间的代理：
 * - 处理聊天请求
 * - 调用 AI 后端服务进行流式请求
 * - 管理请求配置（模型、API Key、系统提示等）
 */
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
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';

import {
  CoreMessage,
  IChatAgent,
  IChatAgentCommand,
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentWelcomeMessage,
} from '../../common';
import { DEFAULT_SYSTEM_PROMPT } from '../../common/prompts/system-prompt';
import { MCPConfigService } from '../mcp/config/mcp-config.service';

import { ChatFeatureRegistry } from './chat.feature.registry';

@Injectable()
export class DefaultChatAgent implements IChatAgent {
  static readonly AGENT_ID = 'Default_Chat_Agent';

  public readonly id: string = DefaultChatAgent.AGENT_ID;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(MonacoCommandRegistry)
  private readonly monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: ChatFeatureRegistry;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  public get metadata(): IChatAgentMetadata {
    return {
      systemPrompt: this.preferenceService.get<string>(AINativeSettingSectionsId.SystemPrompt, DEFAULT_SYSTEM_PROMPT),
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

    const stream = await this.aiBackService.requestStream(
      prompt,
      {
        requestId: request.requestId,
        sessionId: request.sessionId,
        history,
        images: request.images,
        ...(await this.getRequestOptions()),
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
        this.aiReporter.end(request.sessionId + '_' + request.requestId, {
          message: error.message,
          success: false,
          command,
        });
      },
    });

    await chatDeferred.promise;
    return {};
  }

  async provideSlashCommands(_token: CancellationToken): Promise<IChatAgentCommand[]> {
    return this.chatFeatureRegistry.getAllSlashCommand().map((s) => ({
      ...s,
      name: s.name,
      description: s.description || '',
    }));
  }

  async provideChatWelcomeMessage(_token: CancellationToken): Promise<IChatAgentWelcomeMessage | undefined> {
    return undefined;
  }

  public async getRequestOptions() {
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
    const disabledTools = await this.mcpConfigService.getDisabledTools();
    return {
      clientId: this.applicationService.clientId,
      model,
      modelId,
      apiKey,
      baseURL,
      maxTokens,
      system: this.metadata.systemPrompt,
      disabledTools,
    };
  }
}
