import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService, IAIInlineChatService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  AIInlineChatContentWidgetId,
  AINativeSettingSectionsId,
  AISerivceType,
  CancelResponse,
  CancellationTokenSource,
  ChatResponse,
  Disposable,
  ErrorResponse,
  Event,
  IAIReporter,
  IDisposable,
  ILogServiceClient,
  ILoggerManagerClient,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  ReplyResponse,
  SupportLogNamespace,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { AI_DIFF_WIDGET_ID } from '../../../common';
import { CodeActionService } from '../../contrib/code-action/code-action.service';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
import { ERunStrategy } from '../../types';
import { InlineDiffWidget } from '../inline-diff/inline-diff-widget';

import { InlineChatController } from './inline-chat-controller';
import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import { AIInlineChatService, EInlineChatStatus } from './inline-chat.service';
import { AIInlineContentWidget } from './inline-content-widget';
import { InlineHintLineWidget } from './inline-hint-line-widget';

@Injectable()
export class InlineChatHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IAIInlineChatService)
  private readonly aiInlineChatService: AIInlineChatService;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  @Autowired(AICompletionsService)
  private inlineCompletionsService: AICompletionsService;

  private logger: ILogServiceClient;

  private aiDiffWidget: InlineDiffWidget;
  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposed: Disposable = new Disposable();
  private aiInlineChatOperationDisposed: Disposable = new Disposable();
  private cancelIndicator = new CancellationTokenSource();

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private disposeAllWidget() {
    [
      this.aiDiffWidget,
      this.aiInlineContentWidget,
      this.aiInlineChatDisposed,
      this.aiInlineChatOperationDisposed,
    ].forEach((widget) => {
      widget?.dispose();
    });

    this.inlineChatInUsing = false;
  }

  protected inlineChatInUsing = false;

  public registerHintLineFeature(editor: IEditor): IDisposable {
    const { monacoEditor } = editor;
    const hintDisposable = new Disposable();

    const showHint = (position: monaco.Position) => {
      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      if (this.inlineCompletionsService.isVisibleCompletion) {
        return;
      }

      const content = model.getLineContent(position.lineNumber);
      const isEmpty = content?.trim() === empty;
      const isEmptySelection = monacoEditor.getSelection()?.isEmpty();

      if (isEmpty && isEmptySelection) {
        const inlineHintLineWidget = this.injector.get(InlineHintLineWidget, [monacoEditor]);
        inlineHintLineWidget.show({ position });

        hintDisposable.addDispose(inlineHintLineWidget);
      }
    };

    this.disposables.push(
      monacoEditor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
        hintDisposable.dispose();
        showHint(e.position);
      }),
    );

    this.disposables.push(
      monacoEditor.onDidFocusEditorWidget(() => {
        const currentPosition = monacoEditor.getPosition();

        if (currentPosition) {
          hintDisposable.dispose();
          showHint(currentPosition);
        }
      }),
    );

    this.disposables.push(
      monacoEditor.onDidBlurEditorWidget(() => {
        hintDisposable.dispose();
      }),
    );

    this.disposables.push(
      this.inlineCompletionsService.onVisibleCompletion((v) => {
        if (v) {
          hintDisposable.dispose();
        }
      }),
    );

    this.disposables.push(hintDisposable);

    return this;
  }

  public registerInlineChatFeature(editor: IEditor): IDisposable {
    const { monacoEditor } = editor;

    this.disposables.push(
      this.aiInlineChatService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.showInlineChat(editor);
        } else {
          this.cancelToken();
          this.disposeAllWidget();
        }
      }),
      this.codeActionService.onCodeActionRun(({ id, range }) => {
        const currentEditor = this.workbenchEditorService.currentEditor;

        if (currentEditor?.currentUri !== editor.currentUri) {
          return;
        }

        monacoEditor.setSelection(range);
        this.showInlineChat(editor);
        if (this.aiInlineContentWidget) {
          this.aiInlineContentWidget.clickActionId(id, 'codeAction');
        }
      }),
      monacoEditor.onWillChangeModel(() => {
        this.disposeAllWidget();
      }),
    );

    let needShowInlineChat = false;
    this.disposables.push(
      monacoEditor.onMouseDown(() => {
        needShowInlineChat = false;
      }),
      monacoEditor.onMouseUp((event) => {
        const target = event.target;
        const detail = (target as any).detail;
        if (detail && typeof detail === 'string' && detail === AIInlineChatContentWidgetId) {
          needShowInlineChat = false;
        } else {
          needShowInlineChat = true;
        }
      }),
    );

    let prefInlineChatAutoVisible = this.preferenceService.getValid(
      AINativeSettingSectionsId.InlineChatAutoVisible,
      true,
    );
    this.disposables.push(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.InlineChatAutoVisible,
        ({ newValue }) => {
          prefInlineChatAutoVisible = newValue;
        },
      ),
    );

    this.disposables.push(
      Event.debounce(
        Event.any<any>(monacoEditor.onDidChangeCursorSelection, monacoEditor.onMouseUp),
        (_, e) => e,
        100,
      )(() => {
        if (!prefInlineChatAutoVisible || !needShowInlineChat) {
          return;
        }

        if (
          this.aiInlineChatService.status !== EInlineChatStatus.READY &&
          this.aiInlineChatService.status !== EInlineChatStatus.ERROR
        ) {
          return;
        }

        this.showInlineChat(editor);
      }),
    );

    return this;
  }

  protected async showInlineChat(editor: IEditor): Promise<void> {
    if (!this.aiNativeConfigService.capabilities.supportsInlineChat) {
      return;
    }
    if (this.inlineChatInUsing) {
      return;
    }

    this.inlineChatInUsing = true;

    this.disposeAllWidget();

    const { monacoEditor } = editor;

    const selection = monacoEditor.getSelection();

    if (!selection || selection.isEmpty()) {
      this.disposeAllWidget();
      return;
    }

    this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY));

    this.aiInlineContentWidget = this.injector.get(AIInlineContentWidget, [monacoEditor]);

    this.aiInlineContentWidget.show({
      selection,
    });

    this.aiInlineChatDisposed.addDispose(
      this.inlineChatFeatureRegistry.onChatClick(() => {
        this.aiInlineChatService.launchInputVisible(true);
      }),
    );

    this.aiInlineChatDisposed.addDispose(
      this.aiInlineContentWidget.onActionClick(({ actionId, source }) => {
        const handler = this.inlineChatFeatureRegistry.getEditorHandler(actionId);
        const action = this.inlineChatFeatureRegistry.getAction(actionId);
        if (!handler || !action) {
          return;
        }

        this.runInlineChatAction(
          monacoEditor,
          () => {
            const relationId = this.aiReporter.start(action.name, {
              message: action.name,
              type: AISerivceType.InlineChat,
              source,
              runByCodeAction: source === 'codeAction',
            });
            return relationId;
          },
          handler.execute ? handler.execute!.bind(this, monacoEditor, this.cancelIndicator.token) : undefined,
          handler.providerDiffPreviewStrategy
            ? handler.providerDiffPreviewStrategy.bind(this, monacoEditor, this.cancelIndicator.token)
            : undefined,
        );
      }),
    );

    this.aiInlineChatDisposed.addDispose(
      this.aiInlineContentWidget.onInteractiveInputValue(async (value) => {
        const handler = this.inlineChatFeatureRegistry.getInteractiveInputHandler();

        if (!handler) {
          return;
        }

        const strategy = await this.inlineChatFeatureRegistry.getInteractiveInputStrategyHandler()(value);

        this.runInlineChatAction(
          monacoEditor,
          () => {
            const relationId = this.aiReporter.start(AISerivceType.InlineChatInput, {
              message: value,
              type: AISerivceType.InlineChatInput,
              source: 'input',
            });
            return relationId;
          },
          handler.execute && strategy === ERunStrategy.EXECUTE
            ? handler.execute!.bind(this, monacoEditor, value, this.cancelIndicator.token)
            : undefined,
          handler.providerDiffPreviewStrategy && strategy === ERunStrategy.DIFF_PREVIEW
            ? handler.providerDiffPreviewStrategy.bind(this, monacoEditor, value, this.cancelIndicator.token)
            : undefined,
        );
      }),
    );
  }

  private formatAnswer(answer: string, crossCode: string): string {
    const leadingWhitespaceMatch = crossCode.match(/^\s*/);
    const indent = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '  ';
    return answer
      .split('\n')
      .map((line) => `${indent}${line}`)
      .join('\n');
  }

  private convertInlineChatStatus(
    status: EInlineChatStatus,
    reportInfo: {
      relationId: string;
      message: string;
      startTime: number;
      isRetry?: boolean;
      isStop?: boolean;
    },
  ): void {
    const { relationId, message, startTime, isRetry, isStop } = reportInfo;

    this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(status));
    this.aiReporter.end(relationId, {
      message,
      success: status !== EInlineChatStatus.ERROR,
      replytime: Date.now() - startTime,
      isStop,
      isRetry,
    });
  }

  private visibleDiffWidget(
    monacoEditor: monaco.ICodeEditor,
    options: {
      crossSelection: monaco.Selection;
      chatResponse?: ChatResponse | InlineChatController;
    },
    reportInfo: {
      relationId: string;
      startTime: number;
      isRetry: boolean;
    },
  ): void {
    const { crossSelection, chatResponse } = options;
    const { relationId, startTime, isRetry } = reportInfo;

    this.aiDiffWidget = this.injector.get(InlineDiffWidget, [
      AI_DIFF_WIDGET_ID,
      {
        editor: monacoEditor,
        selection: crossSelection,
      },
    ]);
    this.aiDiffWidget.create();
    this.aiDiffWidget.showByLine(
      crossSelection.startLineNumber - 1,
      crossSelection.endLineNumber - crossSelection.startLineNumber + 2,
    );

    if (InlineChatController.is(chatResponse)) {
      const controller = chatResponse as InlineChatController;

      this.aiInlineChatOperationDisposed.addDispose(
        this.aiDiffWidget.onReady(() => {
          const modifiedModel = this.aiDiffWidget.getModifiedModel();
          if (!modifiedModel) {
            return;
          }

          controller.deffered.resolve();

          this.aiInlineChatOperationDisposed.addDispose([
            controller.onData((data) => {
              if (ReplyResponse.is(data)) {
                const { message } = data;

                const lastLine = modifiedModel.getLineCount();
                const lastColumn = modifiedModel.getLineMaxColumn(lastLine);

                const range = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn);

                const edit = {
                  range,
                  text: message || '',
                };
                modifiedModel.pushEditOperations(null, [edit], () => null);
                this.aiDiffWidget.layout();
              }
            }),
            controller.onError((error) => {
              this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
                relationId,
                message: error.message || '',
                startTime,
                isRetry,
              });
              this.aiDiffWidget.layout();
            }),
            controller.onAbort(() => {
              this.convertInlineChatStatus(EInlineChatStatus.READY, {
                relationId,
                message: 'abort',
                startTime,
                isRetry,
                isStop: true,
              });
              this.aiDiffWidget.layout();
            }),
            controller.onEnd(() => {
              this.convertInlineChatStatus(EInlineChatStatus.DONE, {
                relationId,
                message: '',
                startTime,
                isRetry,
              });
              this.aiDiffWidget.layout();
            }),
          ]);
        }),
      );
    } else {
      const model = monacoEditor.getModel();
      const crossCode = model!.getValueInRange(crossSelection);

      if (this.aiInlineChatDisposed.disposed || CancelResponse.is(chatResponse)) {
        this.convertInlineChatStatus(EInlineChatStatus.READY, {
          relationId,
          message: (chatResponse as CancelResponse).message || '',
          startTime,
          isRetry,
          isStop: true,
        });
        return;
      }

      if (ErrorResponse.is(chatResponse)) {
        this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
          relationId,
          message: (chatResponse as ErrorResponse).message || '',
          startTime,
          isRetry,
        });
        return;
      }

      this.convertInlineChatStatus(EInlineChatStatus.DONE, {
        relationId,
        message: '',
        startTime,
        isRetry,
      });

      let answer = (chatResponse as ReplyResponse).message;
      answer = this.formatAnswer(answer, crossCode);

      this.aiInlineChatOperationDisposed.addDispose(
        this.aiDiffWidget.onReady(() => {
          const modifiedModel = this.aiDiffWidget.getModifiedModel();
          if (!modifiedModel) {
            return;
          }

          modifiedModel.setValue(answer);
        }),
      );
    }

    this.aiInlineContentWidget?.setOptions({
      position: {
        lineNumber: crossSelection.endLineNumber + 1,
        column: 1,
      },
    });
    this.aiInlineContentWidget?.layoutContentWidget();
  }

  private async handleDiffPreviewStrategy(
    monacoEditor: monaco.ICodeEditor,
    strategy: (...arg: any[]) => MaybePromise<ChatResponse | InlineChatController>,
    crossSelection: monaco.Selection,
    relationId: string,
    isRetry: boolean,
  ) {
    const model = monacoEditor.getModel();

    this.aiDiffWidget?.dispose();
    this.aiInlineChatOperationDisposed.dispose();
    this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(EInlineChatStatus.THINKING));

    const startTime = Date.now();

    if (this.cancelIndicator.token.isCancellationRequested) {
      this.convertInlineChatStatus(EInlineChatStatus.READY, {
        relationId,
        message: 'abort',
        startTime,
        isRetry,
        isStop: true,
      });
      return;
    }

    const response = await strategy();

    if (CancelResponse.is(response)) {
      this.convertInlineChatStatus(EInlineChatStatus.READY, {
        relationId,
        message: 'abort',
        startTime,
        isRetry,
        isStop: true,
      });
      this.disposeAllWidget();
      return;
    }

    this.visibleDiffWidget(
      monacoEditor,
      { crossSelection, chatResponse: response },
      { relationId, startTime, isRetry },
    );

    this.aiInlineChatOperationDisposed.addDispose([
      this.aiInlineChatService.onAccept(() => {
        this.aiReporter.end(relationId, { message: 'accept', success: true, isReceive: true });
        const newValue = this.aiDiffWidget?.getModifiedModel()?.getValue() || '';

        monacoEditor.getModel()?.pushEditOperations(null, [{ range: crossSelection, text: newValue }], () => null);
        runWhenIdle(() => {
          this.disposeAllWidget();
        });
      }),
      this.aiInlineChatService.onThumbs((isLike: boolean) => {
        this.aiReporter.end(relationId, { isLike });
      }),
      this.aiDiffWidget.onMaxLineCount((count) => {
        requestAnimationFrame(() => {
          if (crossSelection.endLineNumber === model!.getLineCount()) {
            // 如果用户是选中了最后一行，直接显示在最后一行
            const lineHeight = monacoEditor.getOption(monacoApi.editor.EditorOption.lineHeight);
            this.aiInlineContentWidget.offsetTop(lineHeight * count + 12);
          }
        });
      }),
    ]);
  }

  private async runInlineChatAction(
    monacoEditor: monaco.ICodeEditor,
    reporterFn: () => string,
    execute?: () => MaybePromise<void>,
    providerDiffPreviewStrategy?: () => MaybePromise<ChatResponse | InlineChatController>,
  ) {
    const selection = monacoEditor.getSelection();
    if (!selection) {
      this.logger.error('No selection found, aborting inline chat action.');
      return;
    }

    if (execute) {
      await execute();
      this.disposeAllWidget();
    }

    if (providerDiffPreviewStrategy) {
      const crossSelection = selection
        .setStartPosition(selection.startLineNumber, 1)
        .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

      const relationId = reporterFn();

      await this.handleDiffPreviewStrategy(
        monacoEditor,
        providerDiffPreviewStrategy,
        crossSelection,
        relationId,
        false,
      );

      this.aiInlineChatDisposed.addDispose([
        this.aiInlineChatService.onDiscard(() => {
          this.aiReporter.end(relationId, { message: 'discard', success: true, isDrop: true });
          this.disposeAllWidget();
        }),
        this.aiInlineChatService.onRegenerate(async () => {
          await this.handleDiffPreviewStrategy(
            monacoEditor,
            providerDiffPreviewStrategy,
            crossSelection,
            relationId,
            true,
          );
        }),
      ]);
    }
  }
}
