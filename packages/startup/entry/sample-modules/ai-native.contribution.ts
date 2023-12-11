import { Autowired } from '@opensumi/di';
import { AiBackSerivcePath, IAiBackService, InstructionEnum } from '@opensumi/ide-ai-native';
import { AiChatService } from '@opensumi/ide-ai-native/lib/browser/ai-chat.service';
import {
  IAiRunFeatureRegistry,
  IInlineChatFeatureRegistry,
  AiNativeCoreContribution,
  ReplyResponse,
  ErrorResponse,
  CancelResponse,
  IAiMiddleware,
} from '@opensumi/ide-ai-native/lib/browser/types';
import { Domain } from '@opensumi/ide-core-browser';
import { IEditor } from '@opensumi/ide-editor';

enum EInlineOperation {
  Explain = 'Explain',
  Comments = 'Comments',
  Test = 'Test',
  Optimize = 'Optimize',
}

@Domain(AiNativeCoreContribution)
export class AiNativeContribution implements AiNativeCoreContribution {
  @Autowired(AiChatService)
  private readonly aiChatService: AiChatService;

  @Autowired(AiBackSerivcePath)
  private readonly aiBackService: IAiBackService;

  registerRunFeature(registry: IAiRunFeatureRegistry) {
    // Not implements
  }

  middleware: IAiMiddleware = {
    language: {
      provideInlineCompletions: async (model, position, context, token, next) => next(model, position, context, token),
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
            return new ErrorResponse('');
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
}
