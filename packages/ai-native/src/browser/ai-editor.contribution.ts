import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService, IAIInlineChatService, PreferenceService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AINativeSettingSectionsId,
  CancelResponse,
  CancellationToken,
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
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { EditorSelectionChangeEvent, IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { AIInlineChatContentWidget } from '../common';

import { AINativeService } from './ai-native.service';
import { AIInlineCompletionsProvider } from './inline-completions/completeProvider';
import { AICompletionsService } from './inline-completions/service/ai-completions.service';
import { LanguageParserFactory } from './languages/parser';
import { RenameSuggestionsService } from './rename/rename.service';
import { AINativeCoreContribution, IAIMiddleware } from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService, EInlineChatStatus } from './widget/inline-chat/inline-chat.service';
import { AIInlineContentWidget } from './widget/inline-chat/inline-content-widget';
import { AIDiffWidget } from './widget/inline-diff/inline-diff-widget';

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
  protected eventBus: IEventBus;

  @Autowired(LanguageParserFactory)
  protected languageParserFactory: LanguageParserFactory;

  private latestMiddlewareCollector: IAIMiddleware;

  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private aiDiffWidget: AIDiffWidget;
  private aiInlineContentWidget: AIInlineContentWidget;
  private aiInlineChatDisposed: Disposable = new Disposable();
  private aiInlineChatOperationDisposed: Disposable = new Disposable();

  private modelSessionDisposable: Disposable;

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
    if (!editor) {
      return this;
    }

    const { monacoEditor, currentUri } = editor;
    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return this;
    }

    this.registerLanguageFeatures(editor);

    this.disposables.push(
      this.aiNativeService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.showInlineChat(editor);
        } else {
          this.disposeAllWidget();
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
        if (detail && typeof detail === 'string' && detail === AIInlineChatContentWidget) {
          needShowInlineChat = false;
        } else {
          needShowInlineChat = true;
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
      monacoEditor.onDidScrollChange(() => {
        /**
         * 其他的 ctxmenu 服务注册的菜单在 onHide 函数里会有其他逻辑处理，例如在 editor.context.ts 会在 hide 的时候 focus 编辑器，影响使用
         */
        this.ctxMenuRenderer.onHide = undefined;
        this.ctxMenuRenderer.hide(true);
      }),
    );

    let prefInlineChatAutoVisible = this.preferenceService.getValid(
      AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
      true,
    );
    this.disposables.push({
      dispose: () => {
        this.preferenceService.onSpecificPreferenceChange(
          AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
          ({ newValue }) => {
            prefInlineChatAutoVisible = newValue;
          },
        );
      },
    });

    this.disposables.push(
      Event.debounce(
        Event.any<any>(monacoEditor.onDidChangeCursorSelection, monacoEditor.onMouseUp),
        (_, e) => e,
        100,
      )(() => {
        if (!prefInlineChatAutoVisible) {
          return;
        }

        if (!needShowInlineChat) {
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

    // 判断用户是否选择了一块区域或者移动光标 取消掉请补全求
    const selectionChange = () => {
      this.aiCompletionsService.hideStatusBarItem();
      const selection = monacoEditor.getSelection()!;
      // 判断是否选中区域
      if (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn) {
        this.aiInlineCompletionsProvider.cancelRequest();
      }
      requestAnimationFrame(() => {
        this.aiCompletionsService.setVisibleCompletion(false);
      });
    };

    const debouncedSelectionChange = debounce(() => selectionChange(), 50, {
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
    );

    return this;
  }

  protected inlineChatInUsing = false;
  private async showInlineChat(editor: IEditor, actionId?: string): Promise<void> {
    if (!this.aiNativeConfigService.capabilities.supportsInlineChat) {
      return;
    }
    if (this.inlineChatInUsing) {
      return;
    }

    this.inlineChatInUsing = true;

    this.disposeAllWidget();

    const { monacoEditor, currentUri } = editor;

    if (!currentUri || currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    const selection = monacoEditor.getSelection();
    const selectCode = selection && monacoEditor.getModel()?.getValueInRange(selection);

    if (!selection || !selectCode?.trim()) {
      this.disposeAllWidget();
      return;
    }

    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);

    this.aiInlineContentWidget = this.injector.get(AIInlineContentWidget, [monacoEditor]);

    this.aiInlineContentWidget.show({
      selection,
    });

    this.aiInlineChatDisposed.addDispose(
      this.aiInlineContentWidget.onActionClick((id: string) => {
        this.runInlineChatAction(id, monacoEditor);
      }),
    );
    if (actionId) {
      this.aiInlineContentWidget.clickActionId(actionId);
    }
  }

  private async runInlineChatAction(id: string, monacoEditor: monaco.ICodeEditor) {
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
      execute(monacoEditor);
      this.disposeAllWidget();
    }

    if (providerDiffPreviewStrategy) {
      const crossSelection = selection
        .setStartPosition(selection.startLineNumber, 1)
        .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

      const relationId = this.aiReporter.start(action.name, { message: action.name });
      const startTime = +new Date();

      const result = await this.handleDiffPreviewStrategy(
        monacoEditor,
        providerDiffPreviewStrategy,
        crossSelection,
        relationId,
      );

      this.aiReporter.end(relationId, { message: result, success: !!result, replytime: +new Date() - startTime });

      this.aiInlineChatDisposed.addDispose(
        this.aiInlineChatService.onDiscard(() => {
          this.aiReporter.end(relationId, { message: result, success: !!result, isDrop: true });
          this.disposeAllWidget();
        }),
      );

      this.aiInlineChatDisposed.addDispose(
        this.aiInlineChatService.onRegenerate(async () => {
          const retryStartTime = +new Date();
          const retryResult = await this.handleDiffPreviewStrategy(
            monacoEditor,
            providerDiffPreviewStrategy,
            crossSelection,
            relationId,
          );
          this.aiReporter.end(relationId, {
            message: retryResult,
            success: !!result,
            replytime: +new Date() - retryStartTime,
            isRetry: true,
          });
        }),
      );
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
  ): Promise<string | undefined> {
    const model = monacoEditor.getModel();
    if (!model || !crossSelection) {
      return;
    }

    this.resetDiffEnvironment();

    const crossCode = model.getValueInRange(crossSelection);
    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.THINKING);

    const response = await strategy(monacoEditor, this.aiNativeService.cancelIndicator.token);

    if (this.aiInlineChatDisposed.disposed || CancelResponse.is(response)) {
      this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
      return;
    }

    if (ErrorResponse.is(response)) {
      this.aiInlineChatService.launchChatStatus(EInlineChatStatus.ERROR);
      return;
    }

    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.DONE);
    let answer = this.extractAnswerFromResponse(response as ReplyResponse);
    if (!answer) {
      return;
    }

    answer = this.formatAnswer(answer, crossCode);
    this.visibleDiffWidget(monacoEditor, crossSelection, answer);

    this.aiInlineChatOperationDisposed.addDispose([
      this.aiInlineChatService.onAccept(() => {
        this.aiReporter.end(relationId, { message: 'accept', success: true, isReceive: true });
        monacoEditor.getModel()?.pushEditOperations(null, [{ range: crossSelection, text: answer! }], () => null);
        runWhenIdle(() => {
          this.disposeAllWidget();
        });
      }),
      this.aiInlineChatService.onThumbs((isLike: boolean) => {
        this.aiReporter.end(relationId, { isLike });
      }),
      this.aiDiffWidget.onMaxLincCount((count) => {
        requestAnimationFrame(() => {
          if (crossSelection.endLineNumber === model.getLineCount()) {
            const lineHeight = monacoEditor.getOption(monacoApi.editor.EditorOption.lineHeight);
            this.aiInlineContentWidget.offsetTop(lineHeight * count + 12);
          }
        });
      }),
    ]);

    return answer;
  }

  private resetDiffEnvironment(): void {
    this.aiDiffWidget?.dispose();
    this.aiInlineChatOperationDisposed.dispose();
  }

  private extractAnswerFromResponse(response: ReplyResponse): string | undefined {
    const regex = /```\w*([\s\S]+?)\s*```/;
    const match = regex.exec(response.message);
    return match ? match[1].trim() : response.message.trim();
  }

  private formatAnswer(answer: string, crossCode: string): string {
    const leadingWhitespaceMatch = crossCode.match(/^\s*/);
    const indent = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '  ';
    return answer
      .split('\n')
      .map((line, index) => (index === 0 ? line : `${indent}${line}`))
      .join('\n');
  }

  private visibleDiffWidget(monacoEditor: monaco.ICodeEditor, crossSelection: monaco.Selection, answer: string): void {
    monacoEditor.setHiddenAreas([crossSelection], AIDiffWidget._hideId);
    this.aiDiffWidget = this.injector.get(AIDiffWidget, [monacoEditor, crossSelection, answer]);
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
    const { monacoEditor, currentUri } = editor;

    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    this.disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
        (_, e) => e,
        300,
      )(async () => {
        if (this.modelSessionDisposable) {
          this.modelSessionDisposable.dispose();
        }

        const model = monacoEditor.getModel();
        if (!model) {
          return;
        }

        this.modelSessionDisposable = new Disposable();

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
            monacoApi.languages.registerInlineCompletionsProvider(model.getLanguageId(), {
              provideInlineCompletions: async (model, position, context, token) => {
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
              handleItemDidShow: (completions, item) => {
                if (completions.items.length > 0) {
                  this.aiCompletionsService.setVisibleCompletion(true);
                }
              },
            }),
          );
        }

        if (this.aiNativeConfigService.capabilities.supportsRenameSuggestions) {
          const provider = async (model: monaco.ITextModel, range: monaco.IRange, token: CancellationToken) => {
            const result = await this.renameSuggestionService.provideRenameSuggestions(model, range, token);
            return result;
          };

          this.modelSessionDisposable.addDispose(
            monacoApi.languages.registerNewSymbolNameProvider(model.getLanguageId(), {
              provideNewSymbolNames: provider,
            }),
          );
        }

        if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
          // 通过 code actions 来透出我们 inline chat 的功能
          const languageId = model.getLanguageId();
          this.modelSessionDisposable.addDispose(
            this.inlineChatFeatureRegistry.onActionRun(({ id, range }) => {
              monacoEditor.setSelection(range);
              this.showInlineChat(editor, id);
            }),
          );
          this.modelSessionDisposable.addDispose(
            monacoApi.languages.registerCodeActionProvider(languageId, {
              provideCodeActions: async (model) => {
                const parser = this.languageParserFactory(languageId);
                if (!parser) {
                  return;
                }

                const cursorPosition = monacoEditor.getPosition()!;
                const actions = this.inlineChatFeatureRegistry.getCodeActions();
                const functionInfo = await parser.provideFunctionInfo(model, cursorPosition);

                if (functionInfo) {
                  return {
                    actions: actions.map((v) => {
                      const command = {} as monaco.Command;
                      if (v.command) {
                        command.id = v.command.id;
                        command.arguments = [functionInfo.range];
                      }

                      return {
                        ...v,
                        title: v.title + ` for Function: ${functionInfo.name}`,
                        ranges: [functionInfo.range],
                        command,
                      };
                    }) as monaco.CodeAction[],
                    dispose() {},
                  };
                }

                const codeblock = await parser.findCodeBlock(model, cursorPosition);
                if (codeblock) {
                  return {
                    actions: actions.map((v) => {
                      const command = {} as monaco.Command;
                      if (v.command) {
                        command.id = v.command.id;
                        command.arguments = [codeblock.range];
                      }

                      return {
                        ...v,
                        title: v.title,
                        ranges: [codeblock.range],
                        command,
                      };
                    }) as monaco.CodeAction[],
                    dispose() {},
                  };
                }
              },
            }),
          );
        }
      }),
    );
  }

  dispose(): void {
    super.dispose();
    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }
  }
}
