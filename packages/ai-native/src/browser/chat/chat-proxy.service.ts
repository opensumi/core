import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
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
  getOperatingSystemName,
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
  static readonly AGENT_ID = 'Default_Chat_Agent';

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

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private chatDeferred: Deferred<void> = new Deferred<void>();

  public getRequestOptions() {
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
    const agent = this.chatAgentService.getAgent(ChatProxyService.AGENT_ID);
    return {
      clientId: this.applicationService.clientId,
      model,
      modelId,
      apiKey,
      baseURL,
      system: agent?.metadata.systemPrompt,
    };
  }

  public registerDefaultAgent() {
    this.chatAgentViewService.registerChatComponent({
      id: 'toolCall',
      component: ChatToolRender,
      initialProps: {},
    });

    this.addDispose(
      this.chatAgentService.registerAgent({
        id: ChatProxyService.AGENT_ID,
        metadata: {
          systemPrompt:
            this.preferenceService.get<string>(
              AINativeSettingSectionsId.SystemPrompt,
              'You are a powerful AI coding assistant working in OpenSumi, a top IDE framework. You collaborate with a USER to solve coding tasks, which may involve creating, modifying, or debugging code, or answering questions. When the USER sends a message, relevant context (e.g., open files, cursor position, edit history, linter errors) may be attached. Use this information as needed.\n\n<tool_calling>\nYou have access to tools to assist with tasks. Follow these rules:\n1. Always adhere to the tool call schema and provide all required parameters.\n2. Only use tools explicitly provided; ignore unavailable ones.\n3. Avoid mentioning tool names to the USER (e.g., say "I will edit your file" instead of "I need to use the edit_file tool").\n4. Only call tools when necessary; respond directly if the task is general or you already know the answer.\n5. Explain to the USER why you’re using a tool before calling it.\n</tool_calling>\n\n<making_code_changes>\nWhen modifying code:\n1. Use code edit tools instead of outputting code unless explicitly requested.\n2. Limit tool calls to one per turn.\n3. Ensure generated code is immediately executable by including necessary imports, dependencies, and endpoints.\n4. For new projects, create a dependency management file (e.g., requirements.txt) and a README.\n5. For web apps, design a modern, user-friendly UI.\n6. Avoid generating non-textual or excessively long code.\n7. Read file contents before editing, unless appending a small change or creating a new file.\n8. Fix introduced linter errors if possible, but stop after 3 attempts and ask the USER for guidance.\n9. Reapply reasonable code edits if they weren’t followed initially.\n</making_code_changes>\n\nUse the appropriate tools to fulfill the USER’s request, ensuring all required parameters are provided or inferred from context.',
            ) +
            `\n\n<user_info>\nThe user's OS is ${getOperatingSystemName()}. The absolute path of the user's workspace is ${
              this.appConfig.workspaceDir
            }.\n</user_info>`,
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
              ...this.getRequestOptions(),
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
