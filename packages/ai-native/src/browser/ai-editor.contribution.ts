import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  IDisposable,
  URI,
  MaybePromise,
  Disposable,
  Event,
  ILoggerManagerClient,
  SupportLogNamespace,
  ILogServiceClient,
  Schemes,
  CommandService,
} from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';
import { InlineCompletion, InlineCompletions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  AiBackSerivcePath,
  IAiBackService,
  AiNativeSettingSectionsId,
  InstructionEnum,
  IAIReporter,
  AiInlineChatContentWidget,
} from '../common';

import { AiChatService } from './ai-chat.service';
import { AiCodeWidget } from './code-widget/ai-code-widget';
import { AiDiffWidget } from './diff-widget/ai-diff-widget';
import { EInlineOperation } from './inline-chat-widget/inline-chat-controller';
import { AiInlineChatService, EInlineChatStatus } from './inline-chat-widget/inline-chat.service';
import { AiInlineContentWidget } from './inline-chat-widget/inline-content-widget';
import { TypeScriptCompletionsProvider } from './inline-completions/completeProvider';
import { AiBrowserCtxMenuService } from './override/ai-menu.service';
import { AiMenubarService } from './override/layout/menu-bar/menu-bar.service';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AiBackSerivcePath)
  private readonly aiBackService: IAiBackService;

  @Autowired(AiInlineChatService)
  private readonly aiInlineChatService: AiInlineChatService;

  @Autowired(AiChatService)
  private readonly aiChatService: AiChatService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(AiMenubarService)
  private readonly aiMenubarService: AiMenubarService;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: AiBrowserCtxMenuService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private aiDiffWidget: AiDiffWidget;
  private aiCodeWidget: AiCodeWidget;
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
      monacoEditor.onDidScrollChange(() => {
        this.ctxMenuRenderer.hide(true);
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
        const target = event.target;
        const detail = (target as any).detail;
        if (detail && typeof detail === 'string' && detail === AiInlineChatContentWidget) {
          isShowInlineChat = false;
        } else {
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
      relationId: string,
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

      const result = await this.aiBackService.request(
        prompt,
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
      const regExec = regex.exec(answer!);
      answer = (regExec && regExec[1]) || answer;

      this.logger.log('aiGPTcompletionRequest:>>> refresh answer', answer);
      if (answer) {
        const regex = /^\s*/;
        const matches = crossCode.match(regex);
        let spaceCount = 4;
        if (matches) {
          spaceCount = matches[0].length;
        }
        const indents = ' '.repeat(spaceCount);
        const spcode = answer.split('\n');
        answer = spcode.map((s, i) => (i === 0 ? s : indents + s)).join('\n');

        editor.monacoEditor.setHiddenAreas([crossSelection], AiDiffWidget._hideId);

        this.aiDiffWidget = this.injector.get(AiDiffWidget, [monacoEditor!, crossCode, answer, model.getLanguageId()]);
        this.aiDiffWidget.create();
        this.aiDiffWidget.showByLine(
          crossSelection.startLineNumber - 1,
          crossSelection.endLineNumber - crossSelection.startLineNumber + 2,
        );

        this.aiInlineContentWidget?.setOptions({
          position: {
            lineNumber: crossSelection.startLineNumber - 1,
            column: 1,
          },
        });
        this.aiInlineContentWidget?.layoutContentWidget();

        this.aiInlineChatOperationDisposed.addDispose([
          this.aiInlineChatService.onAccept(() => {
            this.aiReporter.end(relationId, { message: 'accept', success: true, isReceive: true });
            monacoEditor.getModel()?.pushEditOperations(
              null,
              [
                {
                  range: crossSelection,
                  text: answer!,
                },
              ],
              () => null,
            );
            setTimeout(() => {
              this.disposeAllWidget();
            }, 110);
          }),
          this.aiInlineChatService.onThumbs((isLike: boolean) => {
            this.aiReporter.end(relationId, { isLike });
          }),
          this.aiDiffWidget.onMaxLincCount((count) => {
            requestAnimationFrame(() => {
              const lineHeight = editor.monacoEditor.getOption(monaco.editor.EditorOption.lineHeight);
              this.aiInlineContentWidget.offsetTop(lineHeight * count + 12);
            });
          }),
        ]);
      }

      return answer;
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
        .setStartPosition(selection.startLineNumber, 1)
        .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

      const crossCode = model.getValueInRange(crossSelection);
      if (value === EInlineOperation.Comments || value === EInlineOperation.Optimize) {
        let prompt = '';
        if (value === EInlineOperation.Comments) {
          prompt = `为以下代码添加注释: \`\`\`\n ${crossCode}\`\`\`。要求只返回代码结果，不需要解释`;
        } else if (value === EInlineOperation.Optimize) {
          prompt = this.aiChatService.optimzeCodePrompt(crossCode);
        }

        const relationId = this.aiReporter.start(value, { message: prompt });
        const startTime = +new Date();

        const result = await handleDiffEditorResult(prompt, crossSelection, true, relationId);

        this.aiReporter.end(relationId, { message: result, success: !!result, replytime: +new Date() - startTime });

        this.aiInlineChatDisposed.addDispose(
          this.aiInlineChatService.onDiscard(() => {
            this.aiReporter.end(relationId, { message: result, success: !!result, isDrop: true });
            setTimeout(() => {
              this.disposeAllWidget();
            }, 110);
          }),
        );

        this.aiInlineChatDisposed.addDispose(
          this.aiInlineChatService.onRegenerate(async () => {
            const retryStartTime = +new Date();
            const retryResult = await handleDiffEditorResult(prompt, crossSelection, false, relationId);
            this.aiReporter.end(relationId, {
              message: retryResult,
              success: !!result,
              replytime: +new Date() - retryStartTime,
              isRetry: true,
            });
          }),
        );

        return;
      }

      if (value === EInlineOperation.Explain) {
        this.aiChatService.launchChatMessage({
          message: `${InstructionEnum.aiExplainKey}\n\`\`\`${model.getLanguageId()}\n${crossCode}\n\`\`\``,
          prompt: this.aiChatService.explainCodePrompt(),
        });
        this.disposeAllWidget();
        return;
      }

      if (value === EInlineOperation.Test) {
        const selectionValue = model.getValueInRange(crossSelection);

        const prompt = this.aiChatService.generateTestCodePrompt(selectionValue);

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

        if (this.aiMenubarService.getLatestWidth() !== 0) {
          this.aiMenubarService.toggleRightPanel();
        }
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

    this.disposables.push(
      Event.debounce(
        monacoEditor.onDidChangeModel,
        (_, e) => e,
        300,
      )(async (event) => {
        if (dispose) {
          dispose.dispose();
        }

        const { monacoEditor, currentUri } = editor;
        if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
          return this;
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

        const inlineCompleteProvider = this.injector.get(TypeScriptCompletionsProvider, [editor]);

        dispose = monaco.languages.registerInlineCompletionsProvider(model.getLanguageId(), {
          provideInlineCompletions: async (model, position, context, token) => {
            const list = await inlineCompleteProvider.provideInlineCompletionItems(editor, position, context, token);
            return list;
          },
          freeInlineCompletions(completions: InlineCompletions<InlineCompletion>) {},
        });
        this.disposables.push(dispose);
      }),
    );
    return;
  }
}
