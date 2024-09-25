import { AINativeConfigService, PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import {
  AIInlineChatContentWidgetId,
  AINativeSettingSectionsId,
  AISerivceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancelResponse,
  CancellationTokenSource,
  ChatResponse,
  ErrorResponse,
  Event,
  IAIReporter,
  ILogServiceClient,
  ILogger,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { ICodeEditor } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { BaseAIMonacoEditorController } from '../../contrib/base';
import { CodeActionService } from '../../contrib/code-action/code-action.service';
import { ERunStrategy } from '../../types';
import { InlineDiffController } from '../inline-diff/inline-diff.controller';

import { InlineChatController } from './inline-chat-controller';
import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import { AIInlineChatService, EInlineChatStatus, EResultKind } from './inline-chat.service';
import { AIInlineContentWidget } from './inline-content-widget';

export class InlineChatEditorController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.chat';

  public static get(editor: ICodeEditor): InlineChatEditorController | null {
    return editor.getContribution(InlineChatEditorController.ID);
  }

  private get aiNativeConfigService(): AINativeConfigService {
    return this.injector.get(AINativeConfigService);
  }

  private get aiInlineChatService(): AIInlineChatService {
    return this.injector.get(AIInlineChatService);
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

  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposable: Disposable = new Disposable();
  private aiInlineChatOperationDisposable: Disposable = new Disposable();
  private inlineChatInUsing = false;

  private inlineDiffController: InlineDiffController;

  mount(): IDisposable {
    this.inlineDiffController = InlineDiffController.get(this.monacoEditor)!;

    this.doContribute();
    return this;
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

  public doContribute(): IDisposable {
    if (!this.monacoEditor) {
      return this;
    }

    const monacoEditor = this.monacoEditor;

    this.disposables.push(
      this.aiInlineChatService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.showInlineChat(monacoEditor);
        } else {
          this.cancelToken();
          this.disposeAllWidget();
        }
      }),
      this.codeActionService.onCodeActionRun(({ id, range }) => {
        const currentEditor = this.workbenchEditorService.currentEditor;

        // 可能存在两个 editor 但 uri 是同一个的情况，所以需要根据 editor 的 id 来判断
        if (currentEditor?.getId() !== monacoEditor!.getId()) {
          return;
        }

        monacoEditor.setSelection(range);
        this.showInlineChat(monacoEditor);
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

        this.showInlineChat(monacoEditor);
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

  protected async showInlineChat(monacoEditor: monaco.ICodeEditor): Promise<void> {
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

          return strategy.bind(this, monacoEditor, this.token);
        };

        this.runAction({
          monacoEditor,
          crossSelection,
          reporterFn: () => {
            const relationId = this.aiReporter.start(action.name, {
              message: action.name,
              type: AISerivceType.InlineChat,
              source,
              runByCodeAction: source === 'codeAction',
              actionSource: source === 'codeAction' ? ActionSourceEnum.CodeAction : ActionSourceEnum.InlineChat,
              actionType: action.name,
            });
            return relationId;
          },
          execute: handler.execute ? handler.execute!.bind(this, monacoEditor, this.token) : undefined,
          providerPreview: previewer(),
          extraData: {
            actionSource: source === 'codeAction' ? ActionSourceEnum.CodeAction : ActionSourceEnum.InlineChat,
            actionType: action.name,
          },
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

        const crossSelection = this.getCrossSelection(monacoEditor);
        if (!crossSelection) {
          return;
        }

        this.runAction({
          monacoEditor,
          crossSelection,
          reporterFn: () => {
            const relationId = this.aiReporter.start(AISerivceType.InlineChatInput, {
              message: value,
              type: AISerivceType.InlineChatInput,
              source: 'input',
              actionSource: ActionSourceEnum.InlineChatInput,
            });
            return relationId;
          },
          execute:
            handler.execute && strategy === ERunStrategy.EXECUTE
              ? handler.execute!.bind(this, monacoEditor, value, this.token)
              : undefined,
          providerPreview:
            handler.providePreviewStrategy && strategy === ERunStrategy.PREVIEW
              ? handler.providePreviewStrategy.bind(this, monacoEditor, value, this.token)
              : undefined,
          extraData: {
            actionSource: ActionSourceEnum.InlineChatInput,
            actionType: strategy,
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
    diffPreviewer.mount(this.aiInlineContentWidget);
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

    this.inlineDiffController.destroyPreviewer(model!.uri.toString());
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

    this.visibleDiffWidget({
      monacoEditor,
      options: { crossSelection, chatResponse: response },
      reportInfo: { relationId, startTime, isRetry, actionType, actionSource },
    });

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
