import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  IDisposable,
  URI,
  MaybePromise,
  Disposable,
  Event,
  uuid,
  ILoggerManagerClient,
  SupportLogNamespace,
  ILogServiceClient,
  Schemes,
} from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';
import { InlineCompletion, InlineCompletions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { AiGPTBackSerivcePath, AiNativeSettingSectionsId, InstructionEnum } from '../common';

import { AiChatService } from './ai-chat.service';
import { AiCodeWidget } from './code-widget/ai-code-widget';
import { AiContentWidget } from './content-widget/ai-content-widget';
import { AiDiffWidget } from './diff-widget/ai-diff-widget';
import { EInlineOperation } from './inline-chat-widget/inline-chat-controller';
import { AiInlineChatService, EInlineChatStatus } from './inline-chat-widget/inline-chat.service';
import { AiInlineContentWidget } from './inline-chat-widget/inline-content-widget';
import { prePromptHandler, preSuffixHandler, ReqStack } from './inline-completions/provider';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AiGPTBackSerivcePath)
  private readonly aiGPTBackService: any;

  @Autowired(AiInlineChatService)
  private readonly aiInlineChatService: AiInlineChatService;

  @Autowired(AiChatService)
  private readonly aiChatService: AiChatService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private aiDiffWidget: AiDiffWidget;
  private aiCodeWidget: AiCodeWidget;
  private aiContentWidget: AiContentWidget;
  private aiInlineContentWidget: AiInlineContentWidget;
  private aiInlineChatDisposed: Disposable = new Disposable();
  private aiInlineChatOperationDisposed: Disposable = new Disposable();

  private disposeAllWidget() {
    if (this.aiDiffWidget) {
      this.aiDiffWidget.dispose();
    }
    if (this.aiCodeWidget) {
      this.aiCodeWidget.dispose();
    }
    if (this.aiContentWidget) {
      this.aiContentWidget.dispose();
    }
    if (this.aiInlineContentWidget) {
      this.aiInlineContentWidget.dispose();
    }
    if (this.aiInlineChatDisposed) {
      this.aiInlineChatDisposed.dispose();
    }
    if (this.aiInlineChatOperationDisposed) {
      this.aiInlineChatOperationDisposed.dispose();
    }

    this.aiChatService.cancelToken();
  }

  contribute(editor: IEditor): IDisposable {
    if (!editor) {
      return this;
    }

    this.registerCompletion(editor);

    const { monacoEditor, currentUri } = editor;
    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return this;
    }

    this.disposables.push(
      monacoEditor.onDidChangeModel(() => {
        this.disposeAllWidget();
      }),
    );

    this.disposables.push(
      this.aiChatService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.registerMiniInlineChat(editor);
        } else {
          this.disposeAllWidget();
        }
      }),
    );

    let isShowInlineChat = false;

    this.disposables.push(
      monacoEditor.onMouseDown(() => {
        isShowInlineChat = false;
      }),
      monacoEditor.onMouseUp((event) => {
        const type = event.target.type;
        if (
          type === monaco.editor.MouseTargetType.CONTENT_TEXT ||
          type === monaco.editor.MouseTargetType.CONTENT_EMPTY
        ) {
          isShowInlineChat = true;
        }
      }),
    );

    Event.debounce(
      Event.any<any>(monacoEditor.onDidChangeCursorSelection, monacoEditor.onMouseUp),
      (_, e) => e,
      100,
    )((e) => {
      if (!this.preferenceService.getValid(AiNativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE)) {
        return;
      }

      if (!isShowInlineChat) {
        return;
      }

      if (
        this.aiInlineChatService.status !== EInlineChatStatus.READY &&
        this.aiInlineChatService.status !== EInlineChatStatus.ERROR
      ) {
        return;
      }

      this.registerMiniInlineChat(editor);
    });

    this.logger.log('AiEditorContribution:>>>', editor, monacoEditor);

    return this;
  }

  /**
   * 新版 inline chat（类似 cursor 那种）
   */
  private async registerMiniInlineChat(editor: IEditor): Promise<void> {
    this.disposeAllWidget();

    const { monacoEditor, currentUri } = editor;

    if (!currentUri) {
      return;
    }

    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    const selection = monacoEditor.getSelection();

    if (!selection) {
      this.disposeAllWidget();
      return;
    }

    const selectCode = monacoEditor.getModel()?.getValueInRange(selection);
    if (!selectCode?.trim()) {
      return;
    }

    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);

    this.aiInlineContentWidget = this.injector.get(AiInlineContentWidget, [monacoEditor]);

    this.aiInlineContentWidget.show({
      selection,
    });

    const handleDiffEditorResult = async (
      prompt: string,
      crossSelection: monaco.Selection,
      enableGptCache = true,
    ) => {
      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      if (this.aiDiffWidget) {
        this.aiDiffWidget.dispose();
      }

      if (this.aiInlineChatOperationDisposed) {
        this.aiInlineChatOperationDisposed.dispose();
      }

      const crossCode = model.getValueInRange(crossSelection);

      this.logger.log('aiGPTcompletionRequest:>>> prompt', prompt);

      this.aiInlineChatService.launchChatStatus(EInlineChatStatus.THINKING);

      const result = await this.aiGPTBackService.aiGPTcompletionRequest(
        prompt,
        {},
        { enableGptCache },
        this.aiChatService.cancelIndicator.token,
      );

      if (this.aiInlineChatDisposed.disposed || result.isCancel) {
        this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
        return;
      }

      // 说明接口有异常
      if (result.errorCode !== 0) {
        this.aiInlineChatService.launchChatStatus(EInlineChatStatus.ERROR);
        return;
      } else {
        this.aiInlineChatService.launchChatStatus(EInlineChatStatus.DONE);
      }

      this.logger.log('aiGPTcompletionRequest:>>> ', result);

      let answer = result && result.data;

      // 提取代码内容
      const regex = /```\w*([\s\S]+?)\s*```/;
      const regExec = regex.exec(answer);
      answer = (regExec && regExec[1]) || answer;

      this.logger.log('aiGPTcompletionRequest:>>> refresh answer', answer);
      if (answer) {
        editor.monacoEditor.setHiddenAreas([crossSelection], AiDiffWidget._hideId);

        this.aiDiffWidget = this.injector.get(AiDiffWidget, [monacoEditor!, crossCode, answer, model.getLanguageId()]);
        this.aiDiffWidget.create();
        this.aiDiffWidget.showByLine(
          crossSelection.startLineNumber - 1,
          crossSelection.endLineNumber - crossSelection.startLineNumber + 2,
        );

        this.aiInlineContentWidget?.setOptions({
          position: {
            lineNumber: crossSelection.endLineNumber + 1,
            column: 0,
          },
        });
        this.aiInlineContentWidget?.layoutContentWidget();

        this.aiInlineChatOperationDisposed.addDispose(
          this.aiInlineChatService.onAccept(() => {
            monacoEditor.getModel()?.pushEditOperations(
              null,
              [
                {
                  range: crossSelection,
                  text: answer,
                },
              ],
              () => null,
            );
            setTimeout(() => {
              this.disposeAllWidget();
            }, 110);
          }),
        );
      }
    };

    const handleOperation = async (value: EInlineOperation, selection: monaco.Selection) => {
      if (this.aiDiffWidget) {
        this.aiDiffWidget.dispose();
      }

      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      const crossSelection = selection
        .setStartPosition(selection.startLineNumber, 0)
        .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

      if (value === EInlineOperation.Comments || value === EInlineOperation.Optimize) {
        const crossCode = model.getValueInRange(crossSelection);

        let prompt = '';
        if (value === EInlineOperation.Comments) {
          prompt = `为以下代码添加注释: \`\`\`\n ${crossCode}\`\`\`。要求只返回代码结果，不需要解释`;
        } else if (value === EInlineOperation.Optimize) {
          prompt = `优化以下代码: \`\`\`\n ${crossCode}\`\`\`。要求只返回代码结果，不需要解释`;
        }

        await handleDiffEditorResult(prompt, crossSelection, true);

        this.aiInlineChatDisposed.addDispose(
          this.aiInlineChatService.onDiscard(() => {
            setTimeout(() => {
              this.disposeAllWidget();
            }, 110);
          }),
        );

        this.aiInlineChatDisposed.addDispose(
          this.aiInlineChatService.onRegenerate(async () => {
            await handleDiffEditorResult(prompt, crossSelection, false);
          }),
        );

        return;
      }

      if (value === EInlineOperation.Explain) {
        this.aiChatService.launchChatMessage({
          message: InstructionEnum.aiExplainKey,
          prompt: this.aiChatService.explainCodePrompt(),
        });
        this.disposeAllWidget();
        return;
      }

      if (value === EInlineOperation.Test) {
        const selectionValue = model.getValueInRange(crossSelection);

        const prompt = `为以下代码写单测：\n\`\`\`${model.getLanguageId()}\n${selectionValue}\n\`\`\``;

        this.aiChatService.launchChatMessage({
          message: prompt,
          prompt,
        });
        this.disposeAllWidget();
        return;
      }
    };

    this.aiInlineChatDisposed.addDispose(
      this.aiInlineContentWidget.onClickOperation(async (value) => {
        handleOperation(value, selection);
      }),
    );
  }

  provideEditorOptionsForUri?(uri: URI): MaybePromise<Partial<MonacoEditor.IEditorOptions>> {
    throw new Error('Method not implemented.');
  }

  /**
   * 代码补全
   */
  private async registerCompletion(editor: IEditor): Promise<void> {
    const { monacoEditor, currentUri, currentDocumentModel } = editor;

    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    let dispose: IDisposable | undefined;

    const cancelRequest = () => {
      if (reqStack) {
        reqStack.cancleRqe();
      }
      if (timer) {
        clearTimeout(timer);
      }
    };

    this.disposables.push(
      monacoEditor.onDidChangeModel(() => {
        if (dispose) {
          dispose.dispose();
        }
      }),
    );

    const reqStack = new ReqStack();
    let timer: any;

    let isCancelFlag = false;

    this.disposables.push(
      Event.debounce(
        monacoEditor.onDidChangeModelContent,
        (_, e) => e,
        300,
      )(async (event) => {
        if (dispose) {
          dispose.dispose();
        }

        const model = monacoEditor.getModel();
        if (!model) {
          return;
        }

        // 取光标的当前位置
        const position = monacoEditor.getPosition();
        if (!position) {
          return;
        }

        cancelRequest();
        dispose = monaco.languages.registerInlineCompletionsProvider(model.getLanguageId(), {
          provideInlineCompletions: async (model, position, context, token) => {
            // 补全上文
            const startRange = new monaco.Range(0, 0, position.lineNumber, position.column);
            let prompt = model.getValueInRange(startRange);

            // 补全下文
            const endRange = new monaco.Range(
              position.lineNumber,
              position.column,
              model.getLineCount(),
              Number.MAX_SAFE_INTEGER,
            );
            let suffix = model.getValueInRange(endRange);

            prompt = prePromptHandler(prompt);
            suffix = preSuffixHandler(suffix);

            const uid = uuid();

            const language = model.getLanguageId();

            reqStack.addReq({
              sendRequest: async () => {
                isCancelFlag = false;
                const completionResult = await this.aiGPTBackService.aiCompletionRequest({
                  prompt,
                  suffix,
                  sessionId: uid,
                  language,
                  fileUrl: model.uri.toString().split('/').pop(),
                });

                const items = completionResult.data.codeModelList;
                this.logger.log('onDidChangeModelContent:>>> ai 补全返回结果', completionResult);
                return {
                  items: items.map((data) => ({
                    insertText: data.content,
                  })),
                };
              },
              cancelRequest: () => {
                isCancelFlag = true;
              },
            });

            await new Promise((f) => {
              timer = setTimeout(f, 300);
            });

            this.logger.log('onDidChangeModelContent:>>> 参数', {
              prompt,
              suffix,
              uid,
              language,
            });

            return reqStack.runReq() || [];
          },
          freeInlineCompletions(completions: InlineCompletions<InlineCompletion>) {},
        });
        this.disposables.push(dispose);
      }),
    );
  }
}
