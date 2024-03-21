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
import {
  AINativeCoreContribution,
  IChatFeatureRegistry,
  IInlineChatFeatureRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
  TChatSlashCommandSend,
} from '@opensumi/ide-ai-native/lib/browser/types';
import { mergeConflictPromptManager } from '@opensumi/ide-ai-native/lib/common/prompts/merge-conflict-prompt';
import { renamePromptManager } from '@opensumi/ide-ai-native/lib/common/prompts/rename-prompt';
import { terminalDetectionPromptManager } from '@opensumi/ide-ai-native/lib/common/prompts/terminal-detection-prompt';
import { Domain, getIcon } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  CancelResponse,
  ErrorResponse,
  IAIBackService,
  MergeConflictEditorMode,
  ReplyResponse,
  getDebugLogger,
} from '@opensumi/ide-core-common';
import { ICodeEditor, NewSymbolName, NewSymbolNameTag } from '@opensumi/ide-monaco';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

enum EInlineOperation {
  Comments = 'Comments',
  Optimize = 'Optimize',
}

@Domain(AINativeCoreContribution)
export class AiNativeContribution implements AINativeCoreContribution {
  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

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
        title: '添加注释',
        renderType: 'button',
      },
      {
        providerDiffPreviewStrategy: async (editor: ICodeEditor, token) => {
          const crossCode = this.getCrossCode(editor);
          const prompt = `Comment the code: \`\`\`\n ${crossCode}\`\`\`. It is required to return only the code results without explanation.`;

          const result = await this.aiBackService.request(prompt, {}, token);

          if (result.isCancel) {
            return new CancelResponse();
          }

          if (result.errorCode !== 0) {
            return new ErrorResponse('');
          }

          return new ReplyResponse(result.data!);
        },
      },
    );

    registry.registerEditorInlineChat(
      {
        id: 'ai-optimize',
        name: EInlineOperation.Optimize,
        renderType: 'dropdown',
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

          return new ReplyResponse(result.data!);
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
          const prompt = terminalDetectionPromptManager.generateBasePrompt(stdout);
          // 通过 ai 后端服务请求
        },
      },
    );
  }

  registerChatFeature(registry: IChatFeatureRegistry): void {
    registry.registerWelcome(
      new MarkdownString(`<img src='https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*66fhSKqpB8EAAAAAAAAAAAAADhl8AQ/original' />
      嗨，我是您的专属 AI 小助手，我在这里回答有关代码的问题，并帮助您思考</br>您可以提问我一些关于代码的问题`),
      [
        {
          icon: getIcon('send-hollow'),
          title: '生成 Java 快速排序算法',
          message: '生成 Java 快速排序算法',
        },
      ],
    );

    registry.registerSlashCommand(
      {
        name: 'Explain',
        description: '解释代码',
        isShortcut: true,
        tooltip: '解释代码',
      },
      {
        providerInputPlaceholder(value, editor) {
          return '请输入或者粘贴代码';
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
        description: '生成单测',
      },
      {
        execute: (value: string, send: TChatSlashCommandSend, editor: ICodeEditor) => {
          send(value);
        },
      },
    );
  }

  registerResolveConflictFeature(registry: IResolveConflictRegistry): void {
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
            prompt = mergeConflictPromptManager.convertDefaultThreeWayRegeneratePrompt(contentMetadata);
          } else {
            prompt = mergeConflictPromptManager.convertDefaultThreeWayPrompt(contentMetadata);
          }

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 2000);

            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });

          return new ReplyResponse('Resolved successfully!');
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
      const prompt = renamePromptManager.requestPrompt(model.getValueInRange(range));

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
        const names = renamePromptManager.extractResponse(result.data);

        return names.map((name) => ({
          newSymbolName: name,
          tags: [NewSymbolNameTag.AIGenerated],
        }));
      }
    });
  }
}
