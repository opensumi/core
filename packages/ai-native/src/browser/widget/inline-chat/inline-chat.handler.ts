import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService, IAIInlineChatService, PreferenceService } from '@opensumi/ide-core-browser';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import {
  AIInlineChatContentWidgetId,
  AINativeSettingSectionsId,
  AISerivceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancelResponse,
  CancellationTokenSource,
  ChatResponse,
  Disposable,
  ErrorResponse,
  Event,
  IAIReporter,
  IDisposable,
  ILogServiceClient,
  ILogger,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { CodeActionService } from '../../contrib/code-action/code-action.service';
import { ERunStrategy } from '../../types';
import { InlineDiffHandler } from '../inline-diff';

import { InlineChatController } from './inline-chat-controller';
import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import { AIInlineChatService, EInlineChatStatus, EResultKind } from './inline-chat.service';
import { AIInlineContentWidget } from './inline-content-widget';

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

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  @Autowired(InlineDiffHandler)
  private readonly inlineDiffHandler: InlineDiffHandler;

  @Autowired(ILogger)
  private logger: ILogServiceClient;

  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposable: Disposable = new Disposable();
  private aiInlineChatOperationDisposable: Disposable = new Disposable();
  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private disposeAllWidget() {
    [this.aiInlineContentWidget, this.aiInlineChatDisposable, this.aiInlineChatOperationDisposable].forEach(
      (widget) => {
        widget?.dispose();
      },
    );

    this.inlineChatInUsing = false;
    this.cancelToken();
  }

  protected inlineChatInUsing = false;

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
      monacoEditor.onMouseDown((event: monaco.IEditorMouseEvent) => {
        const target = event.target;
        const detail = (target as any).detail;

        needShowInlineChat = false;

        if (detail && typeof detail === 'string' && detail === AIInlineChatContentWidgetId) {
          return;
        }

        if (this.aiInlineContentWidget && !this.aiInlineContentWidget.isPersisted) {
          this.disposeAllWidget();
        }
      }),
      monacoEditor.onMouseUp((event: monaco.IEditorMouseEvent) => {
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

        // 处于以下状态时不重新展示 Widget
        // 如果 widget 是隐藏状态，直接展示新 widget
        if (this.aiInlineContentWidget && this.aiInlineContentWidget.isPersisted) {
          return;
        }

        this.showInlineChat(editor);
      }),
    );

    return this;
  }

  protected showInlineContentWidget(monacoEditor: monaco.ICodeEditor, selection: monaco.Selection): void {
    if (this.aiInlineContentWidget) {
      this.aiInlineContentWidget.dispose();
    }
    this.aiInlineContentWidget = this.injector.get(AIInlineContentWidget, [monacoEditor]);

    this.aiInlineContentWidget.show({ selection });
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
      return;
    }

    this.showInlineContentWidget(monacoEditor, selection);

    this.aiInlineChatDisposable.addDispose(
      this.inlineChatFeatureRegistry.onChatClick(() => {
        this.aiInlineChatService.launchInputVisible(true);
      }),
    );

    this.aiInlineChatDisposable.addDispose(
      this.aiInlineContentWidget.onActionClick(({ actionId, source }) => {
        const handler = this.inlineChatFeatureRegistry.getEditorHandler(actionId);
        const action = this.inlineChatFeatureRegistry.getAction(actionId);
        if (!handler || !action) {
          return;
        }

        const previewer = () => {
          // 兼容 providerDiffPreviewStrategy api
          const strategy = handler.providerDiffPreviewStrategy
            ? handler.providerDiffPreviewStrategy
            : handler.providePreviewStrategy;
          if (!strategy) {
            return undefined;
          }

          return strategy.bind(this, monacoEditor, this.cancelIndicator.token);
        };

        this.runInlineChatAction({
          monacoEditor,
          reporterFn: () => {
            const relationId = this.aiReporter.start(action.name, {
              message: action.name,
              type: AISerivceType.InlineChat,
              source,
              runByCodeAction: source === 'codeAction',
              actionSource: action.extra?.actionSource,
              actionType: action.extra?.actionType,
            });
            return relationId;
          },
          execute: handler.execute ? handler.execute!.bind(this, monacoEditor, this.cancelIndicator.token) : undefined,
          providerPreview: previewer(),
          action,
        });
      }),
    );

    this.aiInlineChatDisposable.addDispose(
      this.aiInlineContentWidget.onInteractiveInputValue(async (value) => {
        const handler = this.inlineChatFeatureRegistry.getInteractiveInputHandler();

        if (!handler) {
          return;
        }

        const strategy = await this.inlineChatFeatureRegistry.getInteractiveInputStrategyHandler()(monacoEditor, value);

        this.runInlineChatAction({
          monacoEditor,
          reporterFn: () => {
            const relationId = this.aiReporter.start(AISerivceType.InlineChatInput, {
              message: value,
              type: AISerivceType.InlineChatInput,
              source: 'input',
              actionSource: ActionSourceEnum.InlineChat,
              actionType: ActionTypeEnum.Send,
            });
            return relationId;
          },
          execute:
            handler.execute && strategy === ERunStrategy.EXECUTE
              ? handler.execute!.bind(this, monacoEditor, value, this.cancelIndicator.token)
              : undefined,
          providerPreview:
            handler.providePreviewStrategy && strategy === ERunStrategy.PREVIEW
              ? handler.providePreviewStrategy.bind(this, monacoEditor, value, this.cancelIndicator.token)
              : undefined,
        });
      }),
    );
  }

  private convertInlineChatStatus(
    status: EInlineChatStatus,
    reportInfo: {
      relationId: string;
      message: string;
      startTime: number;
      isRetry?: boolean;
      isStop?: boolean;
      actionSource?: string;
      actionType?: string;
    },
  ): void {
    if (!this.aiInlineContentWidget) {
      return;
    }

    const { relationId, message, startTime, isRetry, isStop } = reportInfo;

    // 获取变更的内容
    let content;
    if (status === EInlineChatStatus.DONE) {
      content = this.inlineDiffHandler.getModifyContent();
    }

    this.aiInlineChatDisposable.addDispose(this.aiInlineContentWidget.launchChatStatus(status));
    this.aiReporter.end(relationId, {
      message,
      success: status !== EInlineChatStatus.ERROR,
      replytime: Date.now() - startTime,
      isStop,
      isRetry,
      content,
      actionType: reportInfo?.actionType,
      actionSource: reportInfo?.actionSource,
    });
  }

  private visibleDiffWidget(params: {
    monacoEditor: monaco.ICodeEditor;
    options: {
      crossSelection: monaco.Selection;
      chatResponse?: ChatResponse | InlineChatController;
    };
    reportInfo: {
      relationId: string;
      startTime: number;
      isRetry: boolean;
    };
    extra?: any;
  }): void {
    const { monacoEditor, options, reportInfo, extra } = params;
    const { chatResponse } = options;
    const { relationId, startTime, isRetry } = reportInfo;

    if (InlineChatController.is(chatResponse)) {
      this.aiInlineChatOperationDisposable.addDispose([
        chatResponse.onError((error) => {
          this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
            relationId,
            message: error.message || '',
            startTime,
            isRetry,
            actionSource: extra?.actionSource,
            actionType: extra?.actionType,
          });
        }),
        chatResponse.onAbort(() => {
          this.convertInlineChatStatus(EInlineChatStatus.READY, {
            relationId,
            message: 'abort',
            startTime,
            isRetry,
            isStop: true,
            actionSource: extra?.actionSource,
            actionType: extra?.actionType,
          });
        }),
        chatResponse.onEnd(() => {
          this.convertInlineChatStatus(EInlineChatStatus.DONE, {
            relationId,
            message: '',
            startTime,
            isRetry,
            actionSource: extra?.actionSource,
            actionType: extra?.actionType,
          });
        }),
      ]);
    } else {
      if ((this.aiInlineContentWidget && this.aiInlineChatDisposable.disposed) || CancelResponse.is(chatResponse)) {
        this.convertInlineChatStatus(EInlineChatStatus.READY, {
          relationId,
          message: (chatResponse as CancelResponse).message || '',
          startTime,
          isRetry,
          isStop: true,
          actionSource: extra?.actionSource,
          actionType: extra?.actionType,
        });
        return;
      }

      if (ErrorResponse.is(chatResponse)) {
        this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
          relationId,
          message: (chatResponse as ErrorResponse).message || '',
          startTime,
          isRetry,
          actionSource: extra?.actionSource,
          actionType: extra?.actionType,
        });
        return;
      }

      this.convertInlineChatStatus(EInlineChatStatus.DONE, {
        relationId,
        message: '',
        startTime,
        isRetry,
        actionSource: extra?.actionSource,
        actionType: extra?.actionType,
      });
    }

    const diffPreviewer = this.inlineDiffHandler.showPreviewerByStream(monacoEditor, options);
    diffPreviewer.mount(this.aiInlineContentWidget);
  }

  private ensureInlineChatVisible(monacoEditor: monaco.ICodeEditor, crossSelection: monaco.Selection) {
    if (this.aiInlineContentWidget.disposed) {
      this.showInlineContentWidget(monacoEditor, crossSelection);
    } else if (this.aiInlineContentWidget.isHidden) {
      this.aiInlineContentWidget.resume();
    }
  }

  /**
   * 重新生成代码
   */
  private async handleDiffPreviewStrategy(params: {
    monacoEditor: monaco.ICodeEditor;
    strategy: (...arg: any[]) => MaybePromise<ChatResponse | InlineChatController>;
    crossSelection: monaco.Selection;
    relationId: string;
    isRetry: boolean;
    actionType?: string;
    actionSource?: string;
  }) {
    if (!this.aiInlineContentWidget) {
      return;
    }
    const { monacoEditor, strategy, crossSelection, relationId, isRetry, actionType, actionSource } = params;
    const model = monacoEditor.getModel();

    this.inlineDiffHandler.destroyPreviewer(model!.uri.toString());
    this.aiInlineChatOperationDisposable.dispose();

    this.ensureInlineChatVisible(monacoEditor, crossSelection);

    this.aiInlineChatDisposable.addDispose(this.aiInlineContentWidget.launchChatStatus(EInlineChatStatus.THINKING));

    const startTime = Date.now();

    if (this.cancelIndicator.token.isCancellationRequested) {
      this.convertInlineChatStatus(EInlineChatStatus.READY, {
        relationId,
        message: 'abort',
        startTime,
        isRetry,
        isStop: true,
        actionSource,
        actionType,
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
        actionSource,
        actionType,
      });
      this.disposeAllWidget();
      return;
    }

    this.visibleDiffWidget({
      monacoEditor,
      options: { crossSelection, chatResponse: response },
      reportInfo: { relationId, startTime, isRetry },
      extra: {
        actionType,
        actionSource,
      },
    });

    this.aiInlineChatOperationDisposable.addDispose([
      this.aiInlineContentWidget.onResultClick((kind: EResultKind) => {
        this.inlineDiffHandler.handleAction(kind);
        const modifyContent = this.inlineDiffHandler.getModifyContent();
        if (kind === EResultKind.ACCEPT) {
          this.aiReporter.end(relationId, {
            message: 'accept',
            success: true,
            isReceive: true,
            content: modifyContent,
            actionSource: ActionSourceEnum.InlineChat,
            actionType: ActionTypeEnum.Accept,
          });
          runWhenIdle(() => {
            this.disposeAllWidget();
          });
        } else if (kind === EResultKind.DISCARD) {
          this.aiReporter.end(relationId, {
            message: 'discard',
            success: true,
            isDrop: true,
            content: modifyContent,
            actionSource: ActionSourceEnum.InlineChat,
            actionType: ActionTypeEnum.Discard,
          });
          runWhenIdle(() => {
            this.disposeAllWidget();
          });
        } else if (kind === EResultKind.REGENERATE) {
          this.aiReporter.end(relationId, {
            message: 'regenerate',
            success: true,
            isDrop: true,
            content: modifyContent,
            actionSource: ActionSourceEnum.InlineChat,
            actionType: ActionTypeEnum.Regenerate,
          });
          this.handleDiffPreviewStrategy({
            monacoEditor,
            strategy,
            crossSelection,
            relationId,
            isRetry: true,
            actionSource,
            actionType,
          });
        }
      }),
      this.aiInlineChatService.onThumbs((isLike: boolean) => {
        this.aiReporter.end(relationId, { isLike });
      }),
      this.inlineDiffHandler.onMaxLineCount((count) => {
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

  private async runInlineChatAction(params: {
    monacoEditor: monaco.ICodeEditor;
    reporterFn: () => string;
    execute?: () => MaybePromise<void>;
    providerPreview?: () => MaybePromise<ChatResponse | InlineChatController>;
    action?: AIActionItem;
  }) {
    const { monacoEditor, reporterFn, execute, providerPreview, action } = params;
    const selection = monacoEditor.getSelection();
    if (!selection) {
      this.logger.error('No selection found, aborting inline chat action.');
      return;
    }

    if (execute) {
      await execute();
      this.disposeAllWidget();
    }

    if (providerPreview) {
      const crossSelection = selection
        .setStartPosition(selection.startLineNumber, 1)
        .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

      const relationId = reporterFn();

      await this.handleDiffPreviewStrategy({
        monacoEditor,
        strategy: providerPreview,
        crossSelection,
        relationId,
        isRetry: false,
        actionSource: action?.extra?.actionSource,
        actionType: action?.extra?.actionType,
      });
    }
  }
}
