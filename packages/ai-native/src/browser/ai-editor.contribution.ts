import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService, IAIInlineChatService, PreferenceService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AIInlineChatContentWidgetId,
  AINativeSettingSectionsId,
  AISerivceType,
  CancelResponse,
  CancellationToken,
  ChatResponse,
  ContributionProvider,
  Disposable,
  ErrorResponse,
  Event,
  IAIReporter,
  IDisposable,
  IEventBus,
  ILogServiceClient,
  ILoggerManagerClient,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  ReplyResponse,
  Schemes,
  SupportLogNamespace,
  getErrorMessage,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorSelectionChangeEvent, IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { MonacoTelemetryService } from '@opensumi/ide-monaco/lib/browser/telemetry.service';

import { AINativeService } from './ai-native.service';
import { AIInlineCompletionsProvider } from './inline-completions/completeProvider';
import { AICompletionsService } from './inline-completions/service/ai-completions.service';
import { LanguageParserService } from './languages/service';
import { ICodeBlockInfo } from './languages/tree-sitter/language-facts/base';
import { RenameSuggestionsService } from './rename/rename.service';
import { AINativeCoreContribution, IAIMiddleware } from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService, EInlineChatStatus } from './widget/inline-chat/inline-chat.service';
import { AIInlineContentWidget } from './widget/inline-chat/inline-content-widget';
import { InlineDiffWidget } from './widget/inline-diff/inline-diff-widget';

@Injectable()
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IAIInlineChatService)
  private readonly aiInlineChatService: AIInlineChatService;

  @Autowired(AINativeService)
  private readonly aiNativeService: AINativeService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(RenameSuggestionsService)
  private readonly renameSuggestionService: RenameSuggestionsService;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(LanguageParserService)
  private languageParserService: LanguageParserService;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired()
  private monacoTelemetryService: MonacoTelemetryService;

  private latestMiddlewareCollector: IAIMiddleware;

  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private aiDiffWidget: InlineDiffWidget;
  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposed: Disposable = new Disposable();
  private aiInlineChatOperationDisposed: Disposable = new Disposable();

  private modelSessionDisposable: Disposable;
  private initialized: boolean = false;

  private disposeAllWidget() {
    [
      this.aiDiffWidget,
      this.aiInlineContentWidget,
      this.aiInlineChatDisposed,
      this.aiInlineChatOperationDisposed,
    ].forEach((widget) => {
      widget?.dispose();
    });

    this.aiNativeService.cancelToken();
    this.inlineChatInUsing = false;
  }

  contribute(editor: IEditor): IDisposable {
    if (!(editor instanceof BrowserCodeEditor) || this.initialized) {
      return this;
    }

    this.disposables.push(
      editor.onRefOpen((e) => {
        const { uri } = e.instance;
        if (uri.codeUri.scheme !== Schemes.file) {
          return;
        }

        this.initialized = true;
        this.contributeInlineCompletionFeature(editor);
        this.contributeInlineChatFeature(editor);
        this.registerLanguageFeatures(editor);
      }),
    );

    const { monacoEditor } = editor;

    this.disposables.push(
      monacoEditor.onDidScrollChange(() => {
        /**
         * 其他的 ctxmenu 服务注册的菜单在 onHide 函数里会有其他逻辑处理，例如在 editor.context.ts 会在 hide 的时候 focus 编辑器，影响使用
         */
        this.ctxMenuRenderer.onHide = undefined;
        this.ctxMenuRenderer.hide(true);
      }),
    );

    return this;
  }

  protected contributeInlineCompletionFeature(editor: IEditor): void {
    const { monacoEditor } = editor;
    // 判断用户是否选择了一块区域或者移动光标 取消掉请补全求
    const selectionChange = () => {
      this.aiCompletionsService.hideStatusBarItem();
      const selection = monacoEditor.getSelection();
      if (!selection) {
        return;
      }

      // 判断是否选中区域
      if (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn) {
        this.aiInlineCompletionsProvider.cancelRequest();
      }
      requestAnimationFrame(() => {
        this.aiCompletionsService.setVisibleCompletion(false);
      });
    };

    const debouncedSelectionChange = debounce(selectionChange, 50, {
      maxWait: 200,
      leading: true,
      trailing: true,
    });

    this.disposables.push(
      this.eventBus.on(EditorSelectionChangeEvent, (e) => {
        if (e.payload.source === 'mouse') {
          debouncedSelectionChange();
        } else {
          debouncedSelectionChange.cancel();
          selectionChange();
        }
      }),
      monacoEditor.onDidChangeModelContent((e) => {
        const changes = e.changes;
        for (const change of changes) {
          if (change.text === '') {
            this.aiInlineCompletionsProvider.isDelEvent = true;
            this.aiInlineCompletionsProvider.cancelRequest();
          } else {
            this.aiInlineCompletionsProvider.isDelEvent = false;
          }
        }
      }),
      monacoEditor.onWillChangeModel(() => {
        this.aiCompletionsService.hideStatusBarItem();
        this.disposeAllWidget();
      }),
      monacoEditor.onDidBlurEditorText(() => {
        this.aiCompletionsService.hideStatusBarItem();
        this.aiCompletionsService.setVisibleCompletion(false);
      }),
    );
  }

  protected contributeInlineChatFeature(editor: IEditor): void {
    const { monacoEditor } = editor;

    this.disposables.push(
      this.aiNativeService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.showInlineChat(editor);
        } else {
          this.disposeAllWidget();
        }
      }),
      // 通过 code actions 来透出我们 inline chat 的功能
      this.inlineChatFeatureRegistry.onCodeActionRun(({ id, range }) => {
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
      AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
      true,
    );
    this.disposables.push(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
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
  }

  shouldAbortRequest(model: monaco.ITextModel) {
    if (model.uri.scheme !== Schemes.file) {
      return true;
    }

    return false;
  }

  protected inlineChatInUsing = false;
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
      this.aiInlineContentWidget.onActionClick((action) => {
        this.runInlineChatAction(action, monacoEditor);
      }),
    );
  }

  private async runInlineChatAction(
    {
      actionId: id,
      source,
    }: {
      actionId: string;
      source: string;
    },
    monacoEditor: monaco.ICodeEditor,
  ) {
    const handler = this.inlineChatFeatureRegistry.getEditorHandler(id);
    const action = this.inlineChatFeatureRegistry.getAction(id);
    if (!handler || !action) {
      return;
    }

    const selection = monacoEditor.getSelection();
    if (!selection) {
      this.logger.error('No selection found, aborting inline chat action.');
      return;
    }

    const { execute, providerDiffPreviewStrategy } = handler;

    if (execute) {
      await execute(monacoEditor);
      this.disposeAllWidget();
    }

    if (providerDiffPreviewStrategy) {
      const crossSelection = selection
        .setStartPosition(selection.startLineNumber, 1)
        .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

      const relationId = this.aiReporter.start(action.name, {
        message: action.name,
        type: AISerivceType.InlineChat,
        source,
        runByCodeAction: source === 'codeAction',
      });

      const result = await this.handleDiffPreviewStrategy(
        monacoEditor,
        providerDiffPreviewStrategy,
        crossSelection,
        relationId,
        false,
      );

      this.aiInlineChatDisposed.addDispose([
        this.aiInlineChatService.onDiscard(() => {
          this.aiReporter.end(relationId, { message: result.message, success: true, isDrop: true });
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

  private async handleDiffPreviewStrategy(
    monacoEditor: monaco.ICodeEditor,
    strategy: (
      editor: monaco.ICodeEditor,
      cancelToken: CancellationToken,
    ) => MaybePromise<ReplyResponse | ErrorResponse | CancelResponse>,
    crossSelection: monaco.Selection,
    relationId: string,
    isRetry: boolean,
  ): Promise<ChatResponse> {
    const model = monacoEditor.getModel();

    this.resetDiffEnvironment();

    const crossCode = model!.getValueInRange(crossSelection);
    this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(EInlineChatStatus.THINKING));

    const startTime = Date.now();
    const response = await strategy(monacoEditor, this.aiNativeService.cancelIndicator.token);

    if (this.aiInlineChatDisposed.disposed || CancelResponse.is(response)) {
      this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY));
      this.aiReporter.end(relationId, {
        message: response.message,
        success: true,
        replytime: Date.now() - startTime,
        isStop: true,
        isRetry,
      });
      return response;
    }

    if (ErrorResponse.is(response)) {
      this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(EInlineChatStatus.ERROR));
      this.aiReporter.end(relationId, {
        message: response.message,
        success: false,
        replytime: Date.now() - startTime,
        isRetry,
      });
      return response;
    }

    this.aiInlineChatDisposed.addDispose(this.aiInlineChatService.launchChatStatus(EInlineChatStatus.DONE));

    this.aiReporter.end(relationId, {
      message: response.message,
      success: true,
      replytime: Date.now() - startTime,
      isRetry,
    });

    let answer = this.extractAnswerFromResponse(response as ReplyResponse);

    answer = this.formatAnswer(answer, crossCode);
    this.visibleDiffWidget(monacoEditor, crossSelection, answer);

    this.aiInlineChatOperationDisposed.addDispose([
      this.aiInlineChatService.onAccept(() => {
        this.aiReporter.end(relationId, { message: 'accept', success: true, isReceive: true });
        const newValue = this.aiDiffWidget?.getModifiedValue() || answer!;

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

    return response;
  }

  private resetDiffEnvironment(): void {
    this.aiDiffWidget?.dispose();
    this.aiInlineChatOperationDisposed.dispose();
  }

  private extractAnswerFromResponse(response: ReplyResponse): string {
    const regex = /```\w*([\s\S]+?)\s*```/;
    const match = regex.exec(response.message);
    return match ? match[1].trim() : response.message.trim();
  }

  private formatAnswer(answer: string, crossCode: string): string {
    const leadingWhitespaceMatch = crossCode.match(/^\s*/);
    const indent = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '  ';
    return answer
      .split('\n')
      .map((line) => `${indent}${line}`)
      .join('\n');
  }

  private visibleDiffWidget(monacoEditor: monaco.ICodeEditor, crossSelection: monaco.Selection, answer: string): void {
    this.aiDiffWidget = this.injector.get(InlineDiffWidget, ['ai-diff-widget', monacoEditor, crossSelection, answer]);
    this.aiDiffWidget.create();
    this.aiDiffWidget.showByLine(
      crossSelection.startLineNumber - 1,
      crossSelection.endLineNumber - crossSelection.startLineNumber + 2,
    );

    this.updateInlineContentWidgetPosition(crossSelection);
  }

  private updateInlineContentWidgetPosition(crossSelection: monaco.Selection): void {
    this.aiInlineContentWidget?.setOptions({
      position: {
        lineNumber: crossSelection.endLineNumber + 1,
        column: 1,
      },
    });
    this.aiInlineContentWidget?.layoutContentWidget();
  }

  private async registerLanguageFeatures(editor: IEditor): Promise<void> {
    const { monacoEditor } = editor;

    const doRegister = async () => {
      if (this.modelSessionDisposable) {
        this.modelSessionDisposable.dispose();
      }

      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      this.modelSessionDisposable = new Disposable();

      const languageId = model.getLanguageId();

      if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
        this.contributions.getContributions().forEach((contribution) => {
          if (contribution.middleware) {
            this.latestMiddlewareCollector = contribution.middleware;
          }
        });

        this.aiInlineCompletionsProvider.registerEditor(editor);
        this.modelSessionDisposable.addDispose({
          dispose: () => {
            this.aiInlineCompletionsProvider.dispose();
          },
        });
        this.modelSessionDisposable.addDispose(
          monacoApi.languages.registerInlineCompletionsProvider(languageId, {
            provideInlineCompletions: async (model, position, context, token) => {
              if (this.shouldAbortRequest(model)) {
                return;
              }

              if (this.latestMiddlewareCollector?.language?.provideInlineCompletions) {
                this.aiCompletionsService.setMiddlewareComplete(
                  this.latestMiddlewareCollector?.language?.provideInlineCompletions,
                );
              }

              const list = await this.aiInlineCompletionsProvider.provideInlineCompletionItems(
                model,
                position,
                context,
                token,
              );

              this.logger.log(
                'provideInlineCompletions: ',
                list.items.map((data) => data.insertText),
              );

              return list;
            },
            freeInlineCompletions() {},
            handleItemDidShow: (completions) => {
              if (completions.items.length > 0) {
                this.aiCompletionsService.setVisibleCompletion(true);
              }
            },
          }),
        );
      }

      if (this.aiNativeConfigService.capabilities.supportsRenameSuggestions) {
        this.modelSessionDisposable.addDispose(this.contributeRenameFeature(languageId));
      }

      if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
        this.modelSessionDisposable.addDispose(this.contributeCodeActionFeature(languageId, editor));
      }
    };

    this.disposables.push(Event.debounce(monacoEditor.onWillChangeModel, (_, e) => e, 300)(doRegister.bind(this)));

    doRegister();
  }

  lastModelRequestRenameEndTime: number | undefined;
  lastModelRequestRenameSessionId: string | undefined;

  protected contributeRenameFeature(languageId: string): IDisposable {
    const disposable = new Disposable();

    const provider = async (model: monaco.ITextModel, range: monaco.IRange, token: CancellationToken) => {
      if (this.shouldAbortRequest(model)) {
        return;
      }

      this.lastModelRequestRenameSessionId = undefined;

      const startTime = +new Date();
      const relationId = this.aiReporter.start('rename', {
        message: 'start',
        type: AISerivceType.Rename,
        modelRequestStartTime: startTime,
      });
      this.lastModelRequestRenameSessionId = relationId;

      const toDispose = token.onCancellationRequested(() => {
        const endTime = +new Date();

        this.aiReporter.end(relationId, {
          message: 'cancel',
          success: false,
          isCancel: true,
          modelRequestStartTime: startTime,
          modelRequestEndTime: endTime,
        });

        this.lastModelRequestRenameSessionId = undefined;
      });

      try {
        const result = await this.renameSuggestionService.provideRenameSuggestions(model, range, token);
        toDispose.dispose();
        this.lastModelRequestRenameEndTime = +new Date();
        return result;
      } catch (error) {
        const endTime = +new Date();
        this.aiReporter.end(relationId, {
          message: 'error:' + getErrorMessage(error),
          success: false,
          modelRequestStartTime: startTime,
          modelRequestEndTime: endTime,
        });
        throw error;
      }
    };

    disposable.addDispose([
      monacoApi.languages.registerNewSymbolNameProvider(languageId, {
        provideNewSymbolNames: provider,
      }),
      this.monacoTelemetryService.onEventLog('renameInvokedEvent', (event) => {
        if (this.lastModelRequestRenameSessionId) {
          this.aiReporter.end(this.lastModelRequestRenameSessionId, {
            message: 'done',
            success: true,
            modelRequestEndTime: this.lastModelRequestRenameEndTime,
            ...event,
          });
        }
      }),
    ]);

    return disposable;
  }

  protected contributeCodeActionFeature(languageId: string, editor: IEditor): IDisposable {
    const disposable = new Disposable();

    let prefInlineChatActionEnabled = this.preferenceService.getValid(
      AINativeSettingSectionsId.INLINE_CHAT_CODE_ACTION_ENABLED,
      true,
    );

    if (!prefInlineChatActionEnabled) {
      return disposable;
    }

    const { monacoEditor } = editor;
    const { languageParserService, inlineChatFeatureRegistry, shouldAbortRequest } = this;

    let codeActionDispose: IDisposable | undefined;

    disposable.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.INLINE_CHAT_CODE_ACTION_ENABLED,
        ({ newValue }) => {
          prefInlineChatActionEnabled = newValue;
          if (newValue) {
            register();
          } else {
            if (codeActionDispose) {
              codeActionDispose.dispose();
              codeActionDispose = undefined;
            }
          }
        },
      ),
    );

    register();

    return disposable;

    function register() {
      // const model = monacoEditor.getModel()!;

      // const providerId = `AI_CODE_ACTION_${languageId}`;
      // const hasCodeActionProvider = languageFeaturesService.codeActionProvider
      //   .all(model)
      //   .some((provider) => provider.displayName === providerId);

      if (codeActionDispose) {
        codeActionDispose.dispose();
        codeActionDispose = undefined;
      }

      codeActionDispose = languageFeaturesService.codeActionProvider.register('*', {
        // displayName: providerId,
        provideCodeActions: async (model) => {
          if (shouldAbortRequest(model)) {
            return;
          }

          if (!prefInlineChatActionEnabled) {
            return;
          }

          const parser = languageParserService.createParser(languageId);
          if (!parser) {
            return;
          }
          const actions = inlineChatFeatureRegistry.getCodeActions();
          if (!actions || actions.length === 0) {
            return;
          }

          const cursorPosition = monacoEditor.getPosition();
          if (!cursorPosition) {
            return;
          }

          function constructCodeActions(info: ICodeBlockInfo) {
            return {
              actions: actions.map((v) => {
                const command = {} as monaco.Command;
                if (v.command) {
                  command.id = v.command.id;
                  command.arguments = [info.range];
                }

                let title = v.title;

                switch (info.infoCategory) {
                  case 'function': {
                    title = title + ` for Function: ${info.name}`;
                  }
                }

                return {
                  ...v,
                  title,
                  ranges: [info.range],
                  command,
                };
              }) as monaco.CodeAction[],
              dispose() {},
            };
          }

          const info = await parser.provideCodeBlockInfo(model, cursorPosition);
          if (info) {
            return constructCodeActions(info);
          }

          // check current line is empty
          const currentLineLength = model.getLineLength(cursorPosition.lineNumber);
          if (currentLineLength !== 0) {
            return;
          }

          // 获取视窗范围内的代码块
          const ranges = monacoEditor.getVisibleRanges();
          if (ranges.length === 0) {
            return;
          }

          // 查找从当前行至视窗最后一行的代码块中是否包含函数
          const newRange = new monaco.Range(cursorPosition.lineNumber, 0, ranges[0].endLineNumber + 1, 0);

          const rangeInfo = await parser.provideCodeBlockInfoInRange(model, newRange);
          if (rangeInfo) {
            return constructCodeActions(rangeInfo);
          }
        },
      });

      disposable.addDispose(codeActionDispose);
    }
  }

  dispose(): void {
    super.dispose();
    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }
  }
}
