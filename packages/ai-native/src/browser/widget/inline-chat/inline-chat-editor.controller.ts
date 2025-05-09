import {
  AINativeConfigService,
  IAIInlineChatService,
  IContextKeyService,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import {
  AIInlineChatContentWidgetId,
  AINativeSettingSectionsId,
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancelResponse,
  ChatResponse,
  Disposable,
  ErrorResponse,
  Event,
  FRAME_THREE,
  IAIReporter,
  IDisposable,
  ILogServiceClient,
  ILogger,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { CONTEXT_IN_DEBUG_MODE_KEY } from '@opensumi/ide-debug';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { BaseAIMonacoEditorController } from '../../contrib/base';
import { CodeActionService } from '../../contrib/code-action/code-action.service';
import { InlineDiffController } from '../inline-diff/inline-diff.controller';

import { InlineChatController } from './inline-chat-controller';
import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import { EInlineChatStatus, EResultKind, InlineChatService } from './inline-chat.service';
import { AIInlineContentWidget } from './inline-content-widget';

export class InlineChatEditorController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.chat';

  public static get(editor: ICodeEditor): InlineChatEditorController | null {
    return editor.getContribution(InlineChatEditorController.ID);
  }

  private get aiNativeConfigService(): AINativeConfigService {
    return this.injector.get(AINativeConfigService);
  }

  private get aiInlineChatService(): InlineChatService {
    return this.injector.get(IAIInlineChatService);
  }

  private get inlineChatFeatureRegistry(): InlineChatFeatureRegistry {
    return this.injector.get(InlineChatFeatureRegistryToken);
  }

  private get preferenceService(): PreferenceService {
    return this.injector.get(PreferenceService);
  }

  private get aiReporter(): IAIReporter {
    return this.injector.get(IAIReporter);
  }

  private get workbenchEditorService(): WorkbenchEditorServiceImpl {
    return this.injector.get(WorkbenchEditorService);
  }

  private get codeActionService(): CodeActionService {
    return this.injector.get(CodeActionService);
  }

  private get logger(): ILogServiceClient {
    return this.injector.get(ILogger);
  }

  private get contextKeyService(): IContextKeyService {
    return this.injector.get(IContextKeyService);
  }

  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposable: Disposable = new Disposable();
  private aiInlineChatOperationDisposable: Disposable = new Disposable();
  private aiNativeContextKey: AINativeContextKey;
  private inlineChatInUsing = false;

  private inlineDiffController: InlineDiffController;

  mount(): IDisposable {
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);
    this.inlineDiffController = InlineDiffController.get(this.monacoEditor)!;

    if (!this.monacoEditor) {
      return this.featureDisposable;
    }

    this.featureDisposable.addDispose(
      this.aiInlineChatService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.showInlineChat(this.monacoEditor);
        } else {
          this.cancelToken();
          this.disposeAllWidget();
        }
      }),
    );

    this.featureDisposable.addDispose(
      this.codeActionService.onCodeActionRun(({ id, range }) => {
        const currentEditor = this.workbenchEditorService.currentEditor;

        // 可能存在两个 editor 但 uri 是同一个的情况，所以需要根据 editor 的 id 来判断
        if (currentEditor?.getId() !== this.monacoEditor!.getId()) {
          return;
        }

        this.monacoEditor.setSelection(range);
        this.showInlineChat(this.monacoEditor);
        if (this.aiInlineContentWidget) {
          this.aiInlineContentWidget.clickActionId(id, 'codeAction');
        }
      }),
    );

    this.featureDisposable.addDispose(
      this.monacoEditor.onWillChangeModel(() => {
        this.disposeAllWidget();
      }),
    );

    let needShowInlineChat = false;
    this.featureDisposable.addDispose(
      this.monacoEditor.onMouseDown((event: monaco.IEditorMouseEvent) => {
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
    );

    this.featureDisposable.addDispose(
      this.monacoEditor.onMouseUp((event: monaco.IEditorMouseEvent) => {
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
    this.featureDisposable.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.InlineChatAutoVisible,
        ({ newValue }) => {
          prefInlineChatAutoVisible = newValue;
        },
      ),
    );

    this.featureDisposable.addDispose(
      Event.debounce(
        Event.any<any>(this.monacoEditor.onDidChangeCursorSelection, this.monacoEditor.onMouseUp),
        (_, e) => e,
        FRAME_THREE,
      )(() => {
        if (!prefInlineChatAutoVisible || !needShowInlineChat) {
          return;
        }

        // 处于以下状态时不重新展示 Widget
        // 如果 widget 是隐藏状态，直接展示新 widget
        if (this.aiInlineContentWidget && this.aiInlineContentWidget.isPersisted) {
          return;
        }

        this.showInlineChat(this.monacoEditor);
      }),
    );

    return this.featureDisposable;
  }

  public disposeAllWidget() {
    [this.aiInlineContentWidget, this.aiInlineChatDisposable, this.aiInlineChatOperationDisposable].forEach(
      (widget) => {
        widget?.dispose();
      },
    );

    this.inlineChatInUsing = false;
    this.cancelToken();
  }

  protected showInlineContentWidget(monacoEditor: monaco.ICodeEditor, selection: monaco.Selection): void {
    if (this.aiInlineContentWidget) {
      this.aiInlineContentWidget.dispose();
    }
    this.aiInlineContentWidget = this.injector.get(AIInlineContentWidget, [monacoEditor]);

    this.aiInlineContentWidget.show({ selection });
  }

  protected async showInlineChat(monacoEditor: monaco.ICodeEditor): Promise<void> {
    // 调试状态下禁用 inline chat。影响调试体验
    const inDebugMode = this.contextKeyService.getContextKeyValue(CONTEXT_IN_DEBUG_MODE_KEY);
    if (inDebugMode) {
      return;
    }

    // 如果 inline input 正在展示，则不展示 inline chat
    const isInlineInputVisible = this.aiNativeContextKey.inlineInputWidgetIsVisible.get();
    if (isInlineInputVisible) {
      return;
    }

    const isInlineStreaming = this.aiNativeContextKey.inlineInputWidgetIsStreaming.get();
    if (isInlineStreaming) {
      return;
    }

    if (!this.aiNativeConfigService.capabilities.supportsInlineChat) {
      return;
    }

    if (this.inlineChatInUsing) {
      return;
    }

    this.inlineChatInUsing = true;

    this.disposeAllWidget();

    const selection = monacoEditor.getSelection();

    if (!selection || selection.isEmpty()) {
      return;
    }

    this.showInlineContentWidget(monacoEditor, selection);

    this.aiInlineChatDisposable.addDispose(
      this.aiInlineContentWidget.onActionClick(({ actionId, source }) => {
        const handler = this.inlineChatFeatureRegistry.getEditorHandler(actionId);
        const action = this.inlineChatFeatureRegistry.getAction(actionId);
        if (!handler || !action) {
          return;
        }

        const crossSelection = this.getCrossSelection(monacoEditor);
        if (!crossSelection) {
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

          return strategy.bind(this, monacoEditor, crossSelection, this.token);
        };

        this.runAction({
          monacoEditor,
          crossSelection,
          reporterFn: () => {
            const relationId = this.aiReporter.start(action.name, {
              message: action.name,
              type: AIServiceType.InlineChat,
              source,
              runByCodeAction: source === 'codeAction',
              actionSource: source === 'codeAction' ? ActionSourceEnum.CodeAction : ActionSourceEnum.InlineChat,
              actionType: action.name,
            });
            return relationId;
          },
          execute: handler.execute ? handler.execute!.bind(this, monacoEditor, crossSelection, this.token) : undefined,
          providerPreview: previewer(),
          extraData: {
            actionSource: source === 'codeAction' ? ActionSourceEnum.CodeAction : ActionSourceEnum.InlineChat,
            actionType: action.name,
          },
        });
      }),
    );
  }

  private getCrossSelection(monacoEditor: monaco.ICodeEditor) {
    const selection = monacoEditor.getSelection();
    if (!selection) {
      this.logger.error('No selection found, aborting inline chat action.');
      return;
    }

    return selection
      .setStartPosition(selection.startLineNumber, 1)
      .setEndPosition(selection.endLineNumber, monacoEditor.getModel()!.getLineMaxColumn(selection.endLineNumber));
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
    let modifyContent: string | undefined;
    if (status === EInlineChatStatus.DONE) {
      modifyContent = this.inlineDiffController.getModifyContent();
    }

    this.aiInlineChatDisposable.addDispose(this.aiInlineContentWidget.launchChatStatus(status));
    this.aiReporter.end(relationId, {
      message,
      success: status !== EInlineChatStatus.ERROR,
      replytime: Date.now() - startTime,
      isStop,
      isRetry,
      code: modifyContent,
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
      actionType?: string;
      actionSource?: string;
    };
  }): void {
    const { monacoEditor, options, reportInfo } = params;
    const { chatResponse } = options;
    const { relationId, startTime, isRetry, actionType, actionSource } = reportInfo;

    if (InlineChatController.is(chatResponse)) {
      this.aiInlineChatOperationDisposable.addDispose([
        chatResponse.onError((error) => {
          this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
            relationId,
            message: error.message || '',
            startTime,
            isRetry,
            actionSource,
            actionType,
          });
        }),
        chatResponse.onAbort(() => {
          this.convertInlineChatStatus(EInlineChatStatus.READY, {
            relationId,
            message: 'abort',
            startTime,
            isRetry,
            isStop: true,
            actionSource,
            actionType,
          });
        }),
        chatResponse.onEnd(() => {
          this.convertInlineChatStatus(EInlineChatStatus.DONE, {
            relationId,
            message: '',
            startTime,
            isRetry,
            actionSource,
            actionType,
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
          actionSource,
          actionType,
        });
        return;
      }

      if (ErrorResponse.is(chatResponse)) {
        this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
          relationId,
          message: (chatResponse as ErrorResponse).message || '',
          startTime,
          isRetry,
          actionSource,
          actionType,
        });
        return;
      }

      this.convertInlineChatStatus(EInlineChatStatus.DONE, {
        relationId,
        message: '',
        startTime,
        isRetry,
        actionSource,
        actionType,
      });
    }

    const diffPreviewer = this.inlineDiffController.showPreviewerByStream(monacoEditor, options);
    diffPreviewer.mountWidget(this.aiInlineContentWidget);
  }

  private ensureInlineChatVisible(monacoEditor: monaco.ICodeEditor, crossSelection: monaco.Selection) {
    if (this.aiInlineContentWidget.disposed) {
      this.showInlineContentWidget(monacoEditor, crossSelection);
    } else if (this.aiInlineContentWidget.isHidden) {
      this.aiInlineContentWidget.resume();
    }
  }

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

    this.aiInlineChatOperationDisposable.dispose();

    this.ensureInlineChatVisible(monacoEditor, crossSelection);
    this.aiInlineChatDisposable.addDispose(this.aiInlineContentWidget.launchChatStatus(EInlineChatStatus.THINKING));

    const startTime = Date.now();

    if (this.token.isCancellationRequested) {
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

    this.aiInlineChatOperationDisposable.addDispose([
      this.aiInlineContentWidget.onResultClick((kind: EResultKind) => {
        const modifyContent = this.inlineDiffController.getModifyContent();
        const originContent = this.inlineDiffController.getOriginContent();
        this.inlineDiffController.handleAction(kind);
        if (kind === EResultKind.ACCEPT) {
          this.aiReporter.end(relationId, {
            message: 'accept',
            success: true,
            isReceive: true,
            isDrop: false,
            code: modifyContent,
            originCode: originContent,
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
            isReceive: false,
            code: modifyContent,
            originCode: originContent,
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
            isReceive: false,
            code: modifyContent,
            originCode: originContent,
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
      this.inlineDiffController.onMaxLineCount((count) => {
        requestAnimationFrame(() => {
          if (crossSelection.endLineNumber === model!.getLineCount()) {
            // 如果用户是选中了最后一行，直接显示在最后一行
            const lineHeight = monacoEditor.getOption(monacoApi.editor.EditorOption.lineHeight);
            this.aiInlineContentWidget.setOffsetTop(lineHeight * count + 12);
          }
        });
      }),
    ]);

    this.visibleDiffWidget({
      monacoEditor,
      options: { crossSelection, chatResponse: response },
      reportInfo: { relationId, startTime, isRetry, actionType, actionSource },
    });
  }

  public async runAction(params: {
    monacoEditor: monaco.ICodeEditor;
    reporterFn: () => string;
    crossSelection: monaco.Selection;
    execute?: () => MaybePromise<void>;
    providerPreview?: () => MaybePromise<ChatResponse | InlineChatController>;
    extraData?: {
      actionSource: string;
      actionType: string;
    };
  }) {
    const { monacoEditor, crossSelection, reporterFn, execute, providerPreview, extraData } = params;

    if (execute) {
      await execute();
      this.disposeAllWidget();
    }

    if (providerPreview) {
      const relationId = reporterFn();

      await this.handleDiffPreviewStrategy({
        monacoEditor,
        strategy: providerPreview,
        crossSelection,
        relationId,
        isRetry: false,
        actionSource: extraData?.actionSource,
        actionType: extraData?.actionType,
      });
    }
  }
}
