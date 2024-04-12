import { Autowired } from '@opensumi/di';
import { InstructionEnum } from '@opensumi/ide-ai-native';
import { AiChatService } from '@opensumi/ide-ai-native/lib/browser/ai-chat.service';
import { renamePromptManager } from '@opensumi/ide-ai-native/lib/browser/prompts/rename-prompt';
import {
  AiNativeCoreContribution,
  CancelResponse,
  ErrorResponse,
  IAiMiddleware,
  IAiRunFeatureRegistry,
  IInlineChatFeatureRegistry,
  IRenameCandidatesProviderRegistry,
  ReplyResponse,
} from '@opensumi/ide-ai-native/lib/browser/types';
import {
  ClientAppContribution,
  Domain,
  IClientApp,
  MaybePromise,
  ProgressLocation,
  getDebugLogger,
} from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { AiBackSerivcePath, IAiBackService } from '@opensumi/ide-core-common/lib/ai-native';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser/debug-configuration-manager';
import { IEditor } from '@opensumi/ide-editor';
import { NewSymbolName, NewSymbolNameTag } from '@opensumi/ide-monaco';

enum EInlineOperation {
  Explain = 'Explain',
  Comments = 'Comments',
  Test = 'Test',
  Optimize = 'Optimize',
}

@Domain(AiNativeCoreContribution, ClientAppContribution)
export class AiNativeContribution implements AiNativeCoreContribution, ClientAppContribution {
  @Autowired(AiChatService)
  private readonly aiChatService: AiChatService;

  @Autowired(AiBackSerivcePath)
  private readonly aiBackService: IAiBackService;

  @Autowired(DebugConfigurationManager)
  private readonly debugConfigurationManager: DebugConfigurationManager;

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  logger = getDebugLogger();

  registerRunFeature(registry: IAiRunFeatureRegistry) {
    // Not implements
  }

  middleware: IAiMiddleware = {
    language: {
      provideInlineCompletions: async (model, position, token, next, bean) => next(bean),
    },
  };

  private getCrossCode(editor: IEditor): string {
    const { monacoEditor } = editor;
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
    registry.registerInlineChat(
      {
        id: 'ai-explain',
        name: EInlineOperation.Explain,
        title: '解释代码',
        renderType: 'button',
      },
      {
        execute: (editor: IEditor) => {
          const { monacoEditor } = editor;
          const model = monacoEditor.getModel();
          if (!model) {
            return;
          }

          const crossCode = this.getCrossCode(editor);

          this.aiChatService.launchChatMessage({
            message: `${InstructionEnum.aiExplainKey}\n\`\`\`${model.getLanguageId()}\n${crossCode}\n\`\`\``,
            prompt: this.aiChatService.explainCodePrompt(),
          });
        },
      },
    );

    registry.registerInlineChat(
      {
        id: 'ai-comments',
        name: EInlineOperation.Comments,
        title: '添加注释',
        renderType: 'button',
      },
      {
        providerDiffPreviewStrategy: async (editor: IEditor, token) => {
          const crossCode = this.getCrossCode(editor);
          const prompt = `为以下代码添加注释: \`\`\`\n ${crossCode}\`\`\`。要求只返回代码结果，不需要解释`;

          const result = await this.aiBackService.request(prompt, {}, token);

          if (result.isCancel) {
            return new CancelResponse();
          }

          if (result.errorCode !== 0) {
            return new ErrorResponse(result.errorCode, result.errorMsg);
          }

          return new ReplyResponse(result.data!);
        },
      },
    );

    registry.registerInlineChat(
      {
        id: 'ai-test',
        name: EInlineOperation.Test,
        title: '生成单测',
        renderType: 'button',
      },
      {
        execute: (editor: IEditor) => {
          const crossCode = this.getCrossCode(editor);
          const prompt = this.aiChatService.generateTestCodePrompt(crossCode);

          this.aiChatService.launchChatMessage({
            message: prompt,
            prompt,
          });
        },
      },
    );

    registry.registerInlineChat(
      {
        id: 'ai-optimize',
        name: EInlineOperation.Optimize,
        renderType: 'dropdown',
      },
      {
        providerDiffPreviewStrategy: async (editor: IEditor, token) => {
          const crossCode = this.getCrossCode(editor);
          const prompt = this.aiChatService.optimzeCodePrompt(crossCode);

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

  onDidStart(app: IClientApp): MaybePromise<void> {
    const innerProgressService = this.progressService;
    // 使用模块的时候，需要在这里注册
    this.debugConfigurationManager.registerInternalDebugConfigurationProvider('ai-native', {
      type: 'ai-native',
      label: 'AI 生成配置',
      popupHint:
        '使用大模型能力，根据项目内容生成配置（大模型生成内容可能有误）（大模型生成内容可能有误）（大模型生成内容可能有误）',
      async provideDebugConfigurations(folder, token) {
        await innerProgressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: '模拟 AI 生成配置中',
          },
          async () => {
            await new Promise((resolve) => {
              setTimeout(() => {
                resolve(undefined);
              }, 5000); // 5 seconds timeout
            });
          },
        );

        // 测试：生成两个配置，然后供用户选择
        return [
          {
            name: '[AI] Launch Program',
            skipFiles: ['<node_internals>/**'],
            type: 'node',
            request: 'launch',
            // autoPick: true, // 使用 autoPick 可以跳过 QuickPick 直接运行（底层逻辑只会检查数组的第一个）
            program: '${workspaceFolder}/index.js',
          },
          {
            name: '[AI2] Run npm start',
            type: 'node',
            request: 'launch',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'start'],
            cwd: '${workspaceFolder}',
            console: 'integratedTerminal',
          },
        ];
      },
    });
    this.debugConfigurationManager.registerInternalDebugConfigurationOverride('pwa-node', {
      type: 'pwa-node',
      label: 'Node.js 项目自动生成',
      popupHint: '通过 Node.js Debug 提供的服务自动分析项目，生成运行配置',
    });
  }
}
