import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  CancellationToken,
  ChatAgentViewServiceToken,
  ChatFeatureRegistryToken,
  ChatServiceToken,
  Deferred,
  Disposable,
  IAIBackService,
  IAIReporter,
  IApplicationService,
  IChatProgress,
  uuid,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { IChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';

import {
  IChatAgentCommand,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentService,
  IChatAgentWelcomeMessage,
} from '../../common';
import { ChatToolRender } from '../components/ChatToolRender';
import { IChatAgentViewService } from '../types';

import { ChatService } from './chat.api.service';
import { ChatFeatureRegistry } from './chat.feature.registry';

/**
 * @internal
 */
@Injectable()
export class ChatProxyService extends Disposable {
  // 避免和插件注册的 agent id 冲突
  static readonly AGENT_ID = 'Default_Chat_Agent_' + uuid(6);

  @Autowired(IChatAgentService)
  private readonly chatAgentService: IChatAgentService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: ChatFeatureRegistry;

  @Autowired(MonacoCommandRegistry)
  private readonly monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired(ChatServiceToken)
  private aiChatService: ChatService;

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

  private chatDeferred: Deferred<void> = new Deferred<void>();

  public registerDefaultAgent() {
    this.chatAgentViewService.registerChatComponent({
      id: 'toolCall',
      component: ChatToolRender,
      initialProps: {},
    });

    this.addDispose(
      this.chatAgentService.registerAgent({
        id: ChatProxyService.AGENT_ID,
        metadata: {},
        invoke: async (
          request: IChatAgentRequest,
          progress: (part: IChatProgress) => void,
          _history: IChatMessage[],
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

          const model = this.preferenceService.get<string>(AINativeSettingSectionsId.LLMModelSelection);
          let apiKey: string = '';
          let baseURL: string = '';
          if (model === 'deepseek') {
            apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.DeepseekApiKey, '');
          } else if (model === 'openai') {
            apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
            baseURL = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiBaseURL, '');
          } else {
            apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.AnthropicApiKey, '');
          }

          const stream = await this.aiBackService.requestStream(
            prompt,
            {
              requestId: request.requestId,
              sessionId: request.sessionId,
              history: this.aiChatService.getHistoryMessages(),
              clientId: this.applicationService.clientId,
              apiKey,
              model,
              baseURL,
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
        provideSlashCommands: async (token: CancellationToken): Promise<IChatAgentCommand[]> =>
          this.chatFeatureRegistry
            .getAllSlashCommand()
            .map((s) => ({ ...s, name: s.name, description: s.description || '' })),
        provideChatWelcomeMessage: async (token: CancellationToken): Promise<IChatAgentWelcomeMessage | undefined> =>
          undefined,
      }),
    );

    queueMicrotask(() => {
      this.chatAgentService.updateAgent(ChatProxyService.AGENT_ID, {});
    });
  }
}
