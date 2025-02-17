import { Autowired } from '@opensumi/di';
import { ChatService } from '@opensumi/ide-ai-native/lib/browser/chat/chat.api.service';
import {
  BaseTerminalDetectionLineMatcher,
  JavaMatcher,
  NPMMatcher,
  NodeMatcher,
  ShellMatcher,
  TSCMatcher,
} from '@opensumi/ide-ai-native/lib/browser/contrib/terminal/matcher';
import { TextWithStyle } from '@opensumi/ide-ai-native/lib/browser/contrib/terminal/utils/ansi-parser';
import {
  AINativeCoreContribution,
  ERunStrategy,
  IChatFeatureRegistry,
  IInlineChatFeatureRegistry,
  IIntelligentCompletionsRegistry,
  IProblemFixContext,
  IProblemFixProviderRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
  ITerminalProviderRegistry,
  TChatSlashCommandSend,
  TerminalSuggestionReadableStream,
} from '@opensumi/ide-ai-native/lib/browser/types';
import { InlineChatController } from '@opensumi/ide-ai-native/lib/browser/widget/inline-chat/inline-chat-controller';
import { MergeConflictPromptManager } from '@opensumi/ide-ai-native/lib/common/prompts/merge-conflict-prompt';
import { RenamePromptManager } from '@opensumi/ide-ai-native/lib/common/prompts/rename-prompt';
import { TerminalDetectionPromptManager } from '@opensumi/ide-ai-native/lib/common/prompts/terminal-detection-prompt';
import { Domain, getIcon } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  CancelResponse,
  CancellationToken,
  ChatResponse,
  ChatServiceToken,
  ErrorResponse,
  IAIBackService,
  MergeConflictEditorMode,
  ReplyResponse,
  getDebugLogger,
} from '@opensumi/ide-core-common';
import { ICodeEditor, ISelection, NewSymbolName, NewSymbolNameTag, Range, Selection } from '@opensumi/ide-monaco';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import { SlashCommand } from './SlashCommand';

export enum EInlineOperation {
  Comments = 'Comments',
  Optimize = 'Optimize',
  Explain = 'Explain',
}

@Domain(AINativeCoreContribution)
export class AINativeContribution implements AINativeCoreContribution {
  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(TerminalDetectionPromptManager)
  terminalDetectionPromptManager: TerminalDetectionPromptManager;

  @Autowired(RenamePromptManager)
  renamePromptManager: RenamePromptManager;

  @Autowired(MergeConflictPromptManager)
  mergeConflictPromptManager: MergeConflictPromptManager;

  @Autowired(ChatServiceToken)
  private readonly aiChatService: ChatService;

  logger = getDebugLogger();

  registerInlineChatFeature(registry: IInlineChatFeatureRegistry) {
    registry.registerInteractiveInput(
      {
        handleStrategy: (editor, value) => {
          if (value.includes('execute')) {
            return ERunStrategy.EXECUTE;
          }

          return ERunStrategy.PREVIEW;
        },
      },
      {
        execute: async (editor, selection, value, token) => {},
        providePreviewStrategy: async (editor, selection, value, token) => {
          const crossCode = editor.getModel()?.getValueInRange(Selection.liftSelection(selection));
          const prompt = `Comment the code: \`\`\`\n ${crossCode}\`\`\`. It is required to return only the code results without explanation.`;
          const controller = new InlineChatController({ enableCodeblockRender: true });
          const stream = await this.aiBackService.requestStream(prompt, {}, token);
          controller.mountReadable(stream);

          return controller;
        },
      },
    );

    registry.registerEditorInlineChat(
      {
        id: 'ai-comments',
        name: EInlineOperation.Comments,
        title: 'add comments（readable stream example）',
        renderType: 'button',
        codeAction: {
          isPreferred: true,
          kind: 'refactor.rewrite',
        },
      },
      {
        providePreviewStrategy: async (editor: ICodeEditor, selection: ISelection, token) => {
          const crossCode = editor.getModel()?.getValueInRange(Selection.liftSelection(selection));
          const prompt = `Comment the code: \`\`\`\n ${crossCode}\`\`\`. It is required to return only the code results without explanation.`;

          const controller = new InlineChatController({ enableCodeblockRender: true });
          const stream = await this.aiBackService.requestStream(prompt, {}, token);
          controller.mountReadable(stream);

          return controller;
        },
      },
    );

    registry.registerEditorInlineChat(
      {
        id: 'ai-optimize',
        name: EInlineOperation.Optimize,
        renderType: 'dropdown',
        codeAction: {
          isPreferred: true,
          kind: 'refactor.rewrite',
        },
      },
      {
        providePreviewStrategy: async (editor: ICodeEditor, selection: ISelection, token) => {
          const crossCode = editor.getModel()?.getValueInRange(Selection.liftSelection(selection));
          const prompt = `Optimize the code:\n\`\`\`\n ${crossCode}\`\`\``;

          const result = await this.aiBackService.request(prompt, {}, token);
          if (result.isCancel) {
            return new CancelResponse();
          }

          if (result.errorCode !== 0) {
            return new ErrorResponse('');
          }

          const reply: ReplyResponse = new ReplyResponse(result.data!);
          reply.updateMessage(reply.extractCodeContent());

          return reply;
        },
      },
    );

    registry.registerEditorInlineChat(
      {
        id: 'ai-explain',
        name: EInlineOperation.Explain,
        renderType: 'button',
        codeAction: {
          isPreferred: true,
        },
      },
      {
        execute: async (editor: ICodeEditor, selection: ISelection, token) => {
          const model = editor.getModel();
          if (!model) {
            return;
          }

          const crossCode = editor.getModel()?.getValueInRange(Selection.liftSelection(selection));
          this.aiChatService.sendMessage({
            message: `Explain code: \`\`\`\n${crossCode}\n\`\`\``,
            prompt: `Help me, Explain code: \`\`\`\n${crossCode}\n\`\`\``,
          });
        },
      },
    );

    registry.registerTerminalInlineChat(
      {
        id: 'terminal-explain',
        name: 'explain',
      },
      {
        triggerRules: 'selection',
        execute: async (stdout: string) => {},
      },
    );

    registry.registerTerminalInlineChat(
      {
        id: 'terminal-debug',
        name: 'debug',
      },
      {
        triggerRules: [
          NodeMatcher,
          TSCMatcher,
          NPMMatcher,
          ShellMatcher,
          JavaMatcher,
          // 也可以自定义 matcher 规则
          class extends BaseTerminalDetectionLineMatcher {
            doMatch(output: TextWithStyle[]): boolean {
              return output.some((t) => t.content.includes('debug'));
            }
          },
        ],
        execute: async (stdout: string, stdin: string, rule) => {
          const prompt = this.terminalDetectionPromptManager.generateBasePrompt(stdout);
          // 通过 ai 后端服务请求
        },
      },
    );
  }

  registerChatFeature(registry: IChatFeatureRegistry): void {
    registry.registerWelcome(
      new MarkdownString(`<img src='https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*66fhSKqpB8EAAAAAAAAAAAAADhl8AQ/original' />
      Hello, I am your dedicated AI assistant, here to answer questions about code and help you think. You can ask me some questions about code.`),
      [
        {
          icon: getIcon('send-hollow'),
          title: 'Generate a Java Quicksort Algorithm',
          message: 'Generate a Java Quicksort Algorithm',
        },
      ],
    );

    registry.registerSlashCommand(
      {
        name: 'Explain',
        description: 'Explain',
        isShortcut: true,
        tooltip: 'Explain',
      },
      {
        providerRender: SlashCommand,
        providerInputPlaceholder(value, editor) {
          return 'Please enter or paste the code.';
        },
        providerPrompt(value, editor) {
          return `Explain code: \`\`\`\n${value}\n\`\`\``;
        },
        execute: (value: string, send: TChatSlashCommandSend, editor: ICodeEditor) => {
          send(value);
        },
      },
    );

    registry.registerSlashCommand(
      {
        name: 'Test',
        description: 'Test',
      },
      {
        execute: (value: string, send: TChatSlashCommandSend, editor: ICodeEditor) => {
          send(value);
        },
      },
    );
  }

  registerResolveConflictFeature(registry: IResolveConflictRegistry): void {
    registry.registerResolveConflictProvider('traditional', {
      providerRequest: async (contentMetadata, options, token) => {
        const { isRegenerate } = options;
        const cancelController = new AbortController();
        const { signal } = cancelController;

        token.onCancellationRequested(() => {
          cancelController.abort();
        });

        try {
          let prompt = '';

          if (isRegenerate) {
            prompt = this.mergeConflictPromptManager.convertDefaultRegeneratePrompt(contentMetadata);
          } else {
            prompt = this.mergeConflictPromptManager.convertDefaultPrompt(contentMetadata);
          }

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 2000);

            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
          const finalData = `:) ${contentMetadata.current} Hello, AI Native`;
          return new ReplyResponse(finalData);
        } catch (error) {
          if (error.name === 'AbortError') {
            return new CancelResponse();
          }
          throw error;
        }
      },
    });

    registry.registerResolveConflictProvider(MergeConflictEditorMode['3way'], {
      providerRequest: async (contentMetadata, options, token) => {
        const { isRegenerate } = options;
        const cancelController = new AbortController();
        const { signal } = cancelController;

        token.onCancellationRequested(() => {
          cancelController.abort();
        });

        try {
          let prompt = '';

          if (isRegenerate) {
            prompt = this.mergeConflictPromptManager.convertDefaultRegeneratePrompt(contentMetadata);
          } else {
            prompt = this.mergeConflictPromptManager.convertDefaultPrompt(contentMetadata);
          }

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 2000);

            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });

          const finalData = `:) ${contentMetadata.current} Hello, AI Native`;

          return new ReplyResponse(finalData);
        } catch (error) {
          if (error.name === 'AbortError') {
            return new CancelResponse();
          }
          throw error;
        }
      },
    });
  }

  registerRenameProvider(registry: IRenameCandidatesProviderRegistry): void {
    registry.registerRenameSuggestionsProvider(
      async (model, range, triggerKind, token): Promise<NewSymbolName[] | undefined> => {
        const prompt = this.renamePromptManager.requestPrompt(model.getValueInRange(range));

        this.logger.info('rename prompt', prompt);

        const result = await this.aiBackService.request(
          prompt,
          {
            type: 'rename',
          },
          token,
        );

        this.logger.info('rename result', result);

        if (result.data) {
          const names = this.renamePromptManager.extractResponse(result.data);

          return names.map((name) => ({
            newSymbolName: name,
            tags: [NewSymbolNameTag.AIGenerated],
          }));
        }
      },
    );
  }

  registerProblemFixFeature(registry: IProblemFixProviderRegistry): void {
    registry.registerHoverFixProvider({
      provideFix: async (
        editor: ICodeEditor,
        context: IProblemFixContext,
        token: CancellationToken,
      ): Promise<ChatResponse | InlineChatController> => {
        const { marker, editRange } = context;

        const controller = new InlineChatController({ enableCodeblockRender: true });
        const stream = await this.aiBackService.requestStream('', {}, token);
        controller.mountReadable(stream);

        return controller;
      },
    });
  }

  registerTerminalProvider(register: ITerminalProviderRegistry): void {
    register.registerCommandSuggestionsProvider(async (message, token) => {
      const stream = TerminalSuggestionReadableStream.create();

      setTimeout(() => {
        stream.emitData({
          command: 'Terminal Command Suggestion',
          description: '✨ This is a terminal command suggestion',
        });
      }, 1000);

      setTimeout(() => {
        stream.end();
      }, 2000);
      return stream;
    });
  }

  registerIntelligentCompletionFeature(registry: IIntelligentCompletionsRegistry): void {
    registry.registerInlineCompletionsProvider(async (editor, position, bean, token) => ({
      items: [{ insertText: 'Hello OpenSumi' }],
    }));

    registry.registerCodeEditsProvider(async (editor, position, bean, token) => {
      const model = editor.getModel();
      const maxLine = Math.max(position.lineNumber + 3, model?.getLineCount() ?? 0);
      const lineMaxColumn = model!.getLineMaxColumn(maxLine) ?? 1;

      const value = model!.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber + 3,
        endColumn: lineMaxColumn,
      });

      const cancelController = new AbortController();
      const { signal } = cancelController;

      token.onCancellationRequested(() => {
        cancelController.abort();
      });

      /**
       * mock randown
       */
      const getRandomString = (length) => {
        const characters = 'opensumi';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
      };

      const insertRandomStrings = (originalString) => {
        const minChanges = 2;
        const maxChanges = 5;
        const changesCount = Math.floor(Math.random() * (maxChanges - minChanges + 1)) + minChanges;
        let modifiedString = originalString;
        for (let i = 0; i < changesCount; i++) {
          const randomIndex = Math.floor(Math.random() * originalString.length);
          const operation = Math.random() < 0.5 ? 'delete' : 'insert';
          if (operation === 'delete') {
            modifiedString = modifiedString.slice(0, randomIndex) + modifiedString.slice(randomIndex + 1);
          } else {
            const randomChar = getRandomString(1);
            modifiedString = modifiedString.slice(0, randomIndex) + randomChar + modifiedString.slice(randomIndex);
          }
        }
        return modifiedString;
      };

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 1000);

          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });

        return {
          items: [
            {
              insertText: insertRandomStrings(value),
              range: Range.fromPositions(
                {
                  lineNumber: position.lineNumber,
                  column: 1,
                },
                {
                  lineNumber: position.lineNumber + 3,
                  column: lineMaxColumn ?? 1,
                },
              ),
            },
          ],
        };
      } catch (error) {
        throw error;
      }
    });
  }
}
