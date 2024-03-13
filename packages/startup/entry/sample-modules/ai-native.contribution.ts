import { Autowired } from '@opensumi/di';
import {
  AINativeCoreContribution,
  CancelResponse,
  ErrorResponse,
  IInlineChatFeatureRegistry,
  ReplyResponse,
} from '@opensumi/ide-ai-native/lib/browser/types';
import { Domain } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, IAIBackService } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';

enum EInlineOperation {
  Comments = 'Comments',
  Optimize = 'Optimize',
}

@Domain(AINativeCoreContribution)
export class AiNativeContribution implements AINativeCoreContribution {
  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

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
        id: 'ai-comments',
        name: EInlineOperation.Comments,
        title: '添加注释',
        renderType: 'button',
      },
      {
        providerDiffPreviewStrategy: async (editor: IEditor, token) => {
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

    registry.registerInlineChat(
      {
        id: 'ai-optimize',
        name: EInlineOperation.Optimize,
        renderType: 'dropdown',
      },
      {
        providerDiffPreviewStrategy: async (editor: IEditor, token) => {
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
  }
}
