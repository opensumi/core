import { Autowired } from '@opensumi/di';
import {
  BaseTerminalDetectionLineMatcher,
  JavaMatcher,
  NPMMatcher,
  NodeMatcher,
  ShellMatcher,
  TSCMatcher,
} from '@opensumi/ide-ai-native/lib/browser/ai-terminal/matcher';
import { TextWithStyle } from '@opensumi/ide-ai-native/lib/browser/ai-terminal/utils/ansi-parser';
import { ChatService } from '@opensumi/ide-ai-native/lib/browser/chat/chat.api.service';
import {
  AINativeCoreContribution,
  IChatFeatureRegistry,
  IInlineChatFeatureRegistry,
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
  AbortError,
  CancelResponse,
  ChatServiceToken,
  ErrorResponse,
  IAIBackService,
  IChatContent,
  IChatProgress,
  MergeConflictEditorMode,
  ReplyResponse,
  getDebugLogger,
} from '@opensumi/ide-core-common';
import { ICodeEditor, NewSymbolName, NewSymbolNameTag } from '@opensumi/ide-monaco';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import { SlashCommand } from './SlashCommand';

enum EInlineOperation {
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

  private getCrossCode(monacoEditor: ICodeEditor): string {
    const model = monacoEditor.getModel();
    if (!model) {
      return '';
    }

    const selection = monacoEditor.getSelection();

    if (!selection) {
      return '';
    }

    const crossSelection = selection
      .setStartPosition(selection.startLineNumber, 1)
      .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);
    const crossCode = model.getValueInRange(crossSelection);
    return crossCode;
  }

  registerInlineChatFeature(registry: IInlineChatFeatureRegistry) {
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
        providerDiffPreviewStrategy: async (editor: ICodeEditor, token) => {
          const crossCode = this.getCrossCode(editor);
          const prompt = `Comment the code: \`\`\`\n ${crossCode}\`\`\`. It is required to return only the code results without explanation.`;

          const controller = new InlineChatController();
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
        providerDiffPreviewStrategy: async (editor: ICodeEditor, token) => {
          const crossCode = this.getCrossCode(editor);
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
        execute: async (editor: ICodeEditor, token) => {
          const model = editor.getModel();
          if (!model) {
            return;
          }

          const crossCode = this.getCrossCode(editor);
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
    registry.registerRenameSuggestionsProvider(async (model, range, token): Promise<NewSymbolName[] | undefined> => {
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
}
