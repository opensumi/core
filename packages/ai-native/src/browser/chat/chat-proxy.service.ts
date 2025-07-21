import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  CancellationToken,
  ChatAgentViewServiceToken,
  ChatFeatureRegistryToken,
  Deferred,
  Disposable,
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
  IChatAgentCommand,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentService,
  IChatAgentWelcomeMessage,
} from '../../common';
import { DEFAULT_SYSTEM_PROMPT } from '../../common/prompts/system-prompt';
import { ChatToolRender } from '../components/ChatToolRender';
import { MCPConfigService } from '../mcp/config/mcp-config.service';
import { IChatAgentViewService } from '../types';

import { ChatFeatureRegistry } from './chat.feature.registry';

/**
 * @internal
 */
@Injectable()
export class ChatProxyService extends Disposable {
  // 避免和插件注册的 agent id 冲突
  static readonly AGENT_ID = 'Default_Chat_Agent';

  @Autowired(IChatAgentService)
  private readonly chatAgentService: IChatAgentService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: ChatFeatureRegistry;

  @Autowired(MonacoCommandRegistry)
  private readonly monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(ChatAgentViewServiceToken)
  private readonly chatAgentViewService: IChatAgentViewService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  private chatDeferred: Deferred<void> = new Deferred<void>();

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
    const agent = this.chatAgentService.getAgent(ChatProxyService.AGENT_ID);
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

  public registerDefaultAgent() {
    this.chatAgentViewService.registerChatComponent({
      id: 'toolCall',
      component: ChatToolRender,
      initialProps: {},
    });

    this.applicationService.getBackendOS().then(() => {
      this.addDispose(
        this.chatAgentService.registerAgent({
          id: ChatProxyService.AGENT_ID,
          metadata: {
            systemPrompt: this.preferenceService.get<string>(
              AINativeSettingSectionsId.SystemPrompt,
              DEFAULT_SYSTEM_PROMPT,
            ),
          },
          invoke: async (
            request: IChatAgentRequest,
            progress: (part: IChatProgress) => void,
            history: CoreMessage[],
            token: CancellationToken,
          ): Promise<IChatAgentResult> => {
            this.chatDeferred = new Deferred<void>();
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
                this.chatDeferred.resolve();
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

            await this.chatDeferred.promise;
            return {};
          },
          provideSlashCommands: async (): Promise<IChatAgentCommand[]> =>
            this.chatFeatureRegistry
              .getAllSlashCommand()
              .map((s) => ({ ...s, name: s.name, description: s.description || '' })),
          provideChatWelcomeMessage: async (): Promise<IChatAgentWelcomeMessage | undefined> => undefined,
        }),
      );
    });

    queueMicrotask(() => {
      this.chatAgentService.updateAgent(ChatProxyService.AGENT_ID, {});
    });
  }
}
