import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AiNativeConfigService, IAiInlineChatService, PreferenceService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  CancellationToken,
  ContributionProvider,
  Disposable,
  Event,
  IDisposable,
  ILogServiceClient,
  ILoggerManagerClient,
  MaybePromise,
  Schemes,
  SupportLogNamespace,
  URI,
  getErrorMessage,
} from '@opensumi/ide-core-common';
import { AISerivceType, IAIReporter } from '@opensumi/ide-core-common/lib/ai-native/reporter';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { MonacoTelemetryService } from '@opensumi/ide-monaco/lib/browser/telemetry.service';
import { editor as MonacoEditor } from '@opensumi/monaco-editor-core';
import { InlineCompletion, InlineCompletions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

import { AiInlineChatContentWidget, AiNativeSettingSectionsId } from '../common';

import { AiChatService } from './ai-chat.service';
import { AiDiffWidget } from './diff-widget/ai-diff-widget';
import { InlineChatFeatureRegistry } from './inline-chat-widget/inline-chat.feature.registry';
import { AiInlineChatService, EInlineChatStatus } from './inline-chat-widget/inline-chat.service';
import { AiInlineContentWidget } from './inline-chat-widget/inline-content-widget';
import { AiInlineCompletionsProvider } from './inline-completions/completeProvider';
import { AiCompletionsService } from './inline-completions/service/ai-completions.service';
import { LanguageParserFactory } from './languages/parser';
import { AiBrowserCtxMenuService } from './override/ai-menu.service';
import { RenameSuggestionsService } from './rename/rename.service';
import {
  AiNativeCoreContribution,
  CancelResponse,
  ErrorResponse,
  IAiMiddleware,
  IInlineChatFeatureRegistry,
  ReplyResponse,
} from './types';

@Injectable()
export class AiEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired(IAiInlineChatService)
  private readonly aiInlineChatService: AiInlineChatService;

  @Autowired(AiChatService)
  private readonly aiChatService: AiChatService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: AiBrowserCtxMenuService;

  @Autowired(AiInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AiInlineCompletionsProvider;

  @Autowired(IInlineChatFeatureRegistry)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(AiNativeCoreContribution)
  private readonly contributions: ContributionProvider<AiNativeCoreContribution>;

  @Autowired(AiCompletionsService)
  private aiCompletionsService: AiCompletionsService;

  @Autowired(RenameSuggestionsService)
  private readonly renameSuggestionService: RenameSuggestionsService;

  @Autowired(LanguageParserFactory)
  languageParserFactory: LanguageParserFactory;

  private latestMiddlewareCollector: IAiMiddleware;
  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private aiDiffWidget: AiDiffWidget;
  private aiInlineContentWidget: AiInlineContentWidget;
  private aiInlineChatDisposed: Disposable = new Disposable();
  private aiInlineChatOperationDisposed: Disposable = new Disposable();

  private disposeAllWidget() {
    if (this.aiDiffWidget) {
      this.aiDiffWidget.dispose();
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

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      this.contributions.getContributions().forEach((contribution) => {
        if (contribution.middleware) {
          this.latestMiddlewareCollector = contribution.middleware;
        }
      });
      this.registerCompletion(editor);
    }

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.registerCodeActionForInlineChat(editor);
    }
    if (this.aiNativeConfigService.capabilities.supportsRenameSuggestions) {
      this.registerRenameSuggestions(editor);
    }

    this.disposables.push(
      monacoEditor.onWillChangeModel(() => {
        this.disposeAllWidget();
      }),
    );

    this.disposables.push(
      this.inlineChatFeatureRegistry.onActionRun(({ id, range }) => {
        monacoEditor.setSelection(range);
        this.registerInlineChat(editor, id);
      }),
    );

    this.disposables.push(
      monacoEditor.onDidScrollChange(() => {
        /**
         * 其他的 ctxmenu 服务注册的菜单在 onHide 函数里会有其他逻辑处理，例如在 editor.context.ts 会在 hide 的时候 focus 编辑器，影响使用
         */
        this.ctxMenuRenderer.onHide = undefined;
        this.ctxMenuRenderer.hide(true);
      }),
    );

    this.disposables.push(
      this.aiChatService.onInlineChatVisible((value: boolean) => {
        if (value) {
          this.registerInlineChat(editor);
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

    let prefInlineChatAutoVisible = this.preferenceService.getValid(
      AiNativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
      true,
    );
    this.disposables.push({
      dispose: () => {
        this.preferenceService.onSpecificPreferenceChange(
          AiNativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
          ({ newValue }) => {
            prefInlineChatAutoVisible = newValue;
          },
        );
      },
    });

    Event.debounce(
      Event.any<any>(monacoEditor.onDidChangeCursorSelection, monacoEditor.onMouseUp),
      (_, e) => e,
      100,
    )((e) => {
      if (!prefInlineChatAutoVisible) {
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

      const selection = monacoEditor.getSelection();

      if (!selection) {
        return;
      }

      if (selection.isEmpty()) {
        return;
      }

      this.registerInlineChat(editor);
    });

    this.logger.log('AiEditorContribution:>>>', editor, monacoEditor);

    return this;
  }

  inlineChatInUsing = false;
  /**
   * 新版 inline chat（类似 cursor 那种）
   */
  private async registerInlineChat(editor: IEditor, runId?: string): Promise<void> {
    if (this.aiNativeConfigService.capabilities.supportsInlineChat === false) {
      return;
    }
    if (this.inlineChatInUsing) {
      return;
    }
    this.inlineChatInUsing = true;

    this.disposeAllWidget();

    const { monacoEditor, currentUri } = editor;

    const runByCodeAction = Boolean(runId);

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

    this.aiInlineChatDisposed.addDispose(
      this.aiInlineContentWidget.onClickActions(async (id: string) => {
        const handler = this.inlineChatFeatureRegistry.getHandler(id);
        const action = this.inlineChatFeatureRegistry.getAction(id);
        if (!handler || !action) {
          return;
        }

        const { execute, providerDiffPreviewStrategy } = handler;

        if (execute) {
          execute(editor);
          this.disposeAllWidget();
        }

        if (providerDiffPreviewStrategy) {
          const crossSelection = selection
            .setStartPosition(selection.startLineNumber, 1)
            .setEndPosition(selection.endLineNumber, Number.MAX_SAFE_INTEGER);

          const relationId = this.aiReporter.start(action.name, { message: action.name, runByCodeAction });
          const startTime = +new Date();

          const result = await this.handleDiffPreviewStrategy(
            editor,
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
                editor,
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
      }),
    );
    if (runId) {
      this.aiInlineContentWidget.clickActions(runId);
    }
  }

  private async handleDiffPreviewStrategy(
    editor: IEditor,
    strategy: (
      editor: IEditor,
      cancelToken: CancellationToken,
    ) => MaybePromise<ReplyResponse | ErrorResponse | CancelResponse>,
    crossSelection: monaco.Selection,
    relationId: string,
  ): Promise<string | undefined> {
    const model = editor.monacoEditor.getModel();
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

    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.THINKING);

    const response = await strategy(editor, this.aiChatService.cancelIndicator.token);

    if (this.aiInlineChatDisposed.disposed || CancelResponse.is(response)) {
      this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
      return;
    }

    if (ErrorResponse.is(response)) {
      this.aiInlineChatService.launchChatStatus(EInlineChatStatus.ERROR);
      return;
    } else {
      this.aiInlineChatService.launchChatStatus(EInlineChatStatus.DONE);
    }

    let answer = response && response.message;

    // 提取代码内容
    const regex = /```\w*([\s\S]+?)\s*```/;
    const regExec = regex.exec(answer!);
    answer = (regExec && regExec[1]) || answer;

    this.logger.log('fetch response answer:>>>> ', answer);

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

      this.aiDiffWidget = this.injector.get(AiDiffWidget, [editor.monacoEditor!, crossSelection, answer]);
      this.aiDiffWidget.create();
      this.aiDiffWidget.showByLine(
        crossSelection.startLineNumber - 1,
        crossSelection.endLineNumber - crossSelection.startLineNumber + 2,
      );

      this.aiInlineContentWidget?.setOptions({
        position: {
          lineNumber: crossSelection.endLineNumber + 1,
          column: 1,
        },
      });
      this.aiInlineContentWidget?.layoutContentWidget();

      this.aiInlineChatOperationDisposed.addDispose([
        this.aiInlineChatService.onAccept(() => {
          this.aiReporter.end(relationId, { message: 'accept', success: true, isReceive: true });
          editor.monacoEditor.getModel()?.pushEditOperations(
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
            if (crossSelection.endLineNumber === model.getLineCount()) {
              const lineHeight = editor.monacoEditor.getOption(monaco.editor.EditorOption.lineHeight);
              this.aiInlineContentWidget.offsetTop(lineHeight * count + 12);
            }
          });
        }),
      ]);
    }

    return answer;
  }

  provideEditorOptionsForUri?(uri: URI): MaybePromise<Partial<MonacoEditor.IEditorOptions>> {
    throw new Error('Method not implemented.');
  }

  /**
   * 代码补全
   */
  private async registerCompletion(editor: IEditor): Promise<void> {
    const { monacoEditor, currentUri } = editor;

    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    let dispose: IDisposable | undefined;

    this.disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
        (_, e) => e,
        300,
      )(async (event) => {
        if (dispose) {
          dispose.dispose();
          this.aiInlineCompletionsProvider.dispose();
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

        this.aiInlineCompletionsProvider.registerEditor(editor);

        dispose = monacoApi.languages.registerInlineCompletionsProvider(model.getLanguageId(), {
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
              'provideInlineCompletions:>>>> ',
              list.items.map((data) => data.insertText),
            );

            return list;
          },
          freeInlineCompletions(completions: InlineCompletions<InlineCompletion>) {},
          handleItemDidShow: (completions, item) => {
            if (completions.items.length > 0) {
              this.aiCompletionsService.setVisibleCompletion(true);
            }
          },
        });
        this.disposables.push(dispose);
      }),
    );
    return;
  }

  /**
   * 代码补全
   */
  private registerCodeActionForInlineChat(editor: IEditor): void {
    const { monacoEditor, currentUri } = editor;

    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    let dispose: IDisposable | undefined;

    this.disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
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

        const languageId = model.getLanguageId();
        dispose = monacoApi.languages.registerCodeActionProvider(languageId, {
          provideCodeActions: async (model, position, context, token) => {
            const parser = this.languageParserFactory(languageId);
            if (!parser) {
              return null;
            }

            const cursorPosition = monacoEditor.getPosition()!;
            const actions = this.inlineChatFeatureRegistry.getCodeActions();
            const functionInfo = await parser.provideFunctionInfo(model, cursorPosition);

            if (functionInfo) {
              return {
                actions: actions.map((v) => {
                  const command = {} as any;
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
                }) as monaco.languages.CodeAction[],
                dispose() {},
              };
            }

            const codeblock = await parser.findCodeBlock(model, cursorPosition);
            if (codeblock) {
              return {
                actions: actions.map((v) => {
                  const command = {} as any;
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
                }) as monaco.languages.CodeAction[],
                dispose() {},
              };
            }
          },
        });
        this.disposables.push(dispose);
      }),
    );
    return;
  }

  @Autowired()
  monacoTelemetryService: MonacoTelemetryService;

  lastmodelRequestRenameEndTime: number | undefined;
  lastmodelRequestRenameSessionId: string | undefined;

  modelRequestSession = new Map<
    string,
    {
      done: boolean;
    }
  >();

  private async registerRenameSuggestions(editor: IEditor): Promise<void> {
    const { monacoEditor, currentUri } = editor;

    if (currentUri && currentUri.codeUri.scheme !== Schemes.file) {
      return;
    }

    let dispose = new Disposable();

    this.disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
        (_, e) => e,
        300,
      )(async (event) => {
        if (dispose) {
          dispose.dispose();
        }

        dispose = new Disposable();

        const model = monacoEditor.getModel();
        if (!model) {
          return;
        }

        dispose.addDispose(
          this.monacoTelemetryService.onEventLog(({ type, event }) => {
            if (type === 'renameInvokedEvent' && this.lastmodelRequestRenameSessionId) {
              this.aiReporter.end(this.lastmodelRequestRenameSessionId, {
                message: 'rename done',
                success: true,
                modelRequestEndTime: this.lastmodelRequestRenameEndTime,
                ...event,
              });
            }
          }),
        );

        const provider = async (model: monaco.ITextModel, range: monaco.IRange, token: CancellationToken) => {
          this.lastmodelRequestRenameSessionId = undefined;
          const startTime = +new Date();
          const relationId = this.aiReporter.start('rename', {
            message: 'start',
            type: AISerivceType.Rename,
            modelRequestStartTime: startTime,
          });
          this.lastmodelRequestRenameSessionId = relationId;

          const dispose1 = token.onCancellationRequested(() => {
            const endTime = +new Date();

            this.aiReporter.end(relationId, {
              message: 'cancel',
              success: false,
              isCancel: true,
              modelRequestStartTime: startTime,
              modelRequestEndTime: endTime,
            });

            this.lastmodelRequestRenameSessionId = undefined;
          });
          try {
            const result = await this.renameSuggestionService.provideRenameSuggestions(model, range, token);
            dispose1.dispose();
            this.lastmodelRequestRenameEndTime = +new Date();
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

        dispose.addDispose(
          monacoApi.languages.registerNewSymbolNameProvider(model.getLanguageId(), {
            provideNewSymbolNames: provider,
          }),
        );
      }),
    );
  }
}
