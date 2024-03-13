import { Autowired } from '@opensumi/di';
import {
  AINativeCoreContribution,
  CancelResponse,
  ErrorResponse,
  IChatFeatureRegistry,
  IInlineChatFeatureRegistry,
  ReplyResponse,
  TChatSlashCommandSend,
} from '@opensumi/ide-ai-native/lib/browser/types';
import { Domain, getIcon } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, IAIBackService } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

enum EInlineOperation {
  Comments = 'Comments',
  Optimize = 'Optimize',
}

@Domain(AINativeCoreContribution)
export class AiNativeContribution implements AINativeCoreContribution {
  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

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
    registry.registerInlineChat(
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

    registry.registerInlineChat(
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
          return `解释代码: \`\`\`\n${value}\n\`\`\``;
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
        execute: () => {},
      },
    );
  }
}
