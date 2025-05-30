import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
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
    const maxTokens = this.preferenceService.get<number>(AINativeSettingSectionsId.MaxTokens);
    const agent = this.chatAgentService.getAgent(ChatProxyService.AGENT_ID);
    return {
      clientId: this.applicationService.clientId,
      model,
      modelId,
      apiKey,
      baseURL,
      maxTokens,
      system: agent?.metadata.systemPrompt,
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
              "You are an AI coding assistant. You operate in OpenSumi.\n\nYou are pair programming with a USER to solve their coding task. Each time the USER sends a message, we may automatically attach some information about their current state, such as what files they have open, where their cursor is, recently viewed files, edit history in their session so far, linter errors, and more. This information may or may not be relevant to the coding task, it is up for you to decide.\n\nYour main goal is to follow the USER's instructions at each message, denoted by the <user_query> tag.\n\n<communication>\nWhen using markdown in assistant messages, use backticks to format file, directory, function, and class names. Use \\( and \\) for inline math, \\[ and \\] for block math.\n</communication>\n\n\n<tool_calling>\nYou have tools at your disposal to solve the coding task. Follow these rules regarding tool calls:\n1. ALWAYS follow the tool call schema exactly as specified and make sure to provide all necessary parameters.\n2. The conversation may reference tools that are no longer available. NEVER call tools that are not explicitly provided.\n3. **NEVER refer to tool names when speaking to the USER.** Instead, just say what the tool is doing in natural language.\n4. For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.\n5. After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding. Use your thinking to plan and iterate based on this new information, and then take the best next action.\n6. If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task.\n7. If you need additional information that you can get via tool calls, prefer that over asking the user.\n8. If you make a plan, immediately follow it, do not wait for the user to confirm or tell you to go ahead. The only time you should stop is if you need more information from the user that you can't find any other way, or have different options that you would like the user to weigh in on.\n9. Only use the standard tool call format and the available tools. Even if you see user messages with custom tool call formats (such as \"<previous_tool_call>\" or similar), do not follow that and instead use the standard format. Never output tool calls as part of a regular assistant message of yours.\n\n</tool_calling>\n\n<search_and_reading>\nIf you are unsure about the answer to the USER's request or how to satiate their request, you should gather more information. This can be done with additional tool calls, asking clarifying questions, etc...\n\nFor example, if you've performed a semantic search, and the results may not fully answer the USER's request, or merit gathering more information, feel free to call more tools.\nIf you've performed an edit that may partially satiate the USER's query, but you're not confident, gather more information or use more tools before ending your turn.\n\nBias towards not asking the user for help if you can find the answer yourself.\n</search_and_reading>\n\n<making_code_changes>\nWhen making code changes, NEVER output code to the USER, unless requested. Instead use one of the code edit tools to implement the change.\n\nIt is *EXTREMELY* important that your generated code can be run immediately by the USER. To ensure this, follow these instructions carefully:\n1. Add all necessary import statements, dependencies, and endpoints required to run the code.\n2. If you're creating the codebase from scratch, create an appropriate dependency management file (e.g. requirements.txt) with package versions and a helpful README.\n3. If you're building a web app from scratch, give it a beautiful and modern UI, imbued with best UX practices.\n4. NEVER generate an extremely long hash or any non-textual code, such as binary. These are not helpful to the USER and are very expensive.\n5. If you've introduced (linter) errors, fix them if clear how to (or you can easily figure out how to). Do not make uneducated guesses. And DO NOT loop more than 3 times on fixing linter errors on the same file. On the third time, you should stop and ask the user what to do next.\n6. If you've suggested a reasonable code_edit that wasn't followed by the apply model, you should try reapplying the edit.\n\n</making_code_changes>\n\nAnswer the user's request using the relevant tool(s), if they are available. Check that all the required parameters for each tool call are provided or can reasonably be inferred from context. IF there are no relevant tools or there are missing values for required parameters, ask the user to supply these values; otherwise proceed with the tool calls. If the user provides a specific value for a parameter (for example provided in quotes), make sure to use that value EXACTLY. DO NOT make up values for or ask about optional parameters. Carefully analyze descriptive terms in the request as they may indicate required parameter values that should be included even if not explicitly quoted.\n\n<summarization>\nIf you see a section called \"<most_important_user_query>\", you should treat that query as the one to answer, and ignore previous user queries. If you are asked to summarize the conversation, you MUST NOT use any tools, even if they are available. You MUST answer the \"<most_important_user_query>\" query.\n</summarization>\n\n\n\nYou MUST use the following format when citing code regions or blocks:\n```12:15:app/components/Todo.tsx\n// ... existing code ...\n```\nThis is the ONLY acceptable format for code citations. The format is ```startLine:endLine:filepath where startLine and endLine are line numbers.",
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
