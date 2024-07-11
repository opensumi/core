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
  Emitter,
  ErrorResponse,
  Event,
  IAIReporter,
  IDisposable,
  ILogServiceClient,
  ILoggerManagerClient,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  SupportLogNamespace,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { CodeActionService } from '../../contrib/code-action/code-action.service';
import { ERunStrategy } from '../../types';
import { BaseInlineDiffPreviewer } from '../inline-diff/inline-diff-previewer';
import { InlineDiffWidget } from '../inline-diff/inline-diff-widget';
import { InlineDiffService } from '../inline-diff/inline-diff.service';
import { InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';
import { IPartialEditEvent } from '../inline-stream-diff/live-preview.decoration';

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

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  @Autowired(InlineDiffService)
  private readonly inlineDiffService: InlineDiffService;

  private readonly _onPartialEditEvent = this.registerDispose(new Emitter<IPartialEditEvent>());
  public readonly onPartialEditEvent: Event<IPartialEditEvent> = this._onPartialEditEvent.event;

  private logger: ILogServiceClient;

  private diffPreviewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler>;
  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposable: Disposable = new Disposable();
  private aiInlineChatOperationDisposable: Disposable = new Disposable();
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
      this.diffPreviewer,
      this.aiInlineContentWidget,
      this.aiInlineChatDisposable,
      this.aiInlineChatOperationDisposable,
    ].forEach((widget) => {
      widget?.dispose();
    });

    this.inlineChatInUsing = false;
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
          this.aiInlineContentWidget &&
          this.aiInlineContentWidget.status !== EInlineChatStatus.READY &&
          this.aiInlineContentWidget.status !== EInlineChatStatus.ERROR
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
      return;
    }

    this.aiInlineContentWidget = this.injector.get(AIInlineContentWidget, [monacoEditor]);

    this.aiInlineContentWidget.show({ selection });

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

    this.aiInlineChatDisposable.addDispose(
      this.aiInlineContentWidget.onInteractiveInputValue(async (value) => {
        const handler = this.inlineChatFeatureRegistry.getInteractiveInputHandler();

        if (!handler) {
          return;
        }

        const strategy = await this.inlineChatFeatureRegistry.getInteractiveInputStrategyHandler()(monacoEditor, value);

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
    if (!this.aiInlineContentWidget) {
      return;
    }

    const { relationId, message, startTime, isRetry, isStop } = reportInfo;

    this.aiInlineChatDisposable.addDispose(this.aiInlineContentWidget.launchChatStatus(status));
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
    const { chatResponse } = options;
    const { relationId, startTime, isRetry } = reportInfo;

    this.diffPreviewer = this.inlineDiffService.createDiffPreviewer(monacoEditor, options);
    this.diffPreviewer.mount(this.aiInlineContentWidget);

    this.aiInlineChatDisposable.addDispose(this.diffPreviewer);

    if (InlineChatController.is(chatResponse)) {
      this.aiInlineChatOperationDisposable.addDispose([
        chatResponse.onError((error) => {
          this.convertInlineChatStatus(EInlineChatStatus.ERROR, {
            relationId,
            message: error.message || '',
            startTime,
            isRetry,
          });
        }),
        chatResponse.onAbort(() => {
          this.convertInlineChatStatus(EInlineChatStatus.READY, {
            relationId,
            message: 'abort',
            startTime,
            isRetry,
            isStop: true,
          });
        }),
        chatResponse.onEnd(() => {
          this.convertInlineChatStatus(EInlineChatStatus.DONE, {
            relationId,
            message: '',
            startTime,
            isRetry,
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
    }
  }

  private async handleDiffPreviewStrategy(
    monacoEditor: monaco.ICodeEditor,
    strategy: (...arg: any[]) => MaybePromise<ChatResponse | InlineChatController>,
    crossSelection: monaco.Selection,
    relationId: string,
    isRetry: boolean,
  ) {
    if (!this.aiInlineContentWidget) {
      return;
    }

    const model = monacoEditor.getModel();

    this.diffPreviewer?.dispose();
    this.aiInlineChatOperationDisposable.dispose();
    this.aiInlineChatDisposable.addDispose(this.aiInlineContentWidget.launchChatStatus(EInlineChatStatus.THINKING));

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

    this.aiInlineChatOperationDisposable.addDispose([
      this.aiInlineContentWidget.onResultClick((kind: EResultKind) => {
        if (kind === EResultKind.ACCEPT) {
          this.diffPreviewer.handleAction(kind);

          this.aiReporter.end(relationId, { message: 'accept', success: true, isReceive: true });
          runWhenIdle(() => {
            this.disposeAllWidget();
          });
        }
      }),
      this.aiInlineChatService.onThumbs((isLike: boolean) => {
        this.aiReporter.end(relationId, { isLike });
      }),
      this.diffPreviewer.onLineCount((count) => {
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

      this.aiInlineChatDisposable.addDispose([
        this.aiInlineContentWidget.onResultClick(async (kind: EResultKind) => {
          this.diffPreviewer.handleAction(kind);

          if (kind === EResultKind.DISCARD) {
            this.aiReporter.end(relationId, { message: 'discard', success: true, isDrop: true });
            this.disposeAllWidget();
          } else if (kind === EResultKind.REGENERATE) {
            await this.handleDiffPreviewStrategy(
              monacoEditor,
              providerDiffPreviewStrategy,
              crossSelection,
              relationId,
              true,
            );
          }
        }),
      ]);
    }
  }
}
