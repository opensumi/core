import { Autowired, Injectable } from '@opensumi/di';
import {
  AIBackSerivcePath,
  CancellationToken,
  ChatFeatureRegistryToken,
  ChatServiceToken,
  Deferred,
  Disposable,
  IAIBackService,
  IAIReporter,
  IChatProgress,
  uuid,
} from '@opensumi/ide-core-common';
import { IChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';

import {
  IChatAgentCommand,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentService,
  IChatAgentWelcomeMessage,
} from '../../common';

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

  private chatDeferred: Deferred<void> = new Deferred<void>();

  public registerDefaultAgent() {
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

          const stream = await this.aiBackService.requestStream(
            prompt,
            {
              requestId: request.requestId,
              history: this.aiChatService.getHistoryMessages(),
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
