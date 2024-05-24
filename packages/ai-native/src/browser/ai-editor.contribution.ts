import debounce from 'lodash/debounce';

import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AISerivceType,
  CancellationToken,
  ContributionProvider,
  Disposable,
  Event,
  IAIReporter,
  IDisposable,
  IEventBus,
  ILogServiceClient,
  ILoggerManagerClient,
  Schemes,
  SupportLogNamespace,
  getErrorMessage,
} from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { EditorSelectionChangeEvent, IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { MonacoTelemetryService } from '@opensumi/ide-monaco/lib/browser/telemetry.service';

import { CodeActionHandler } from './contrib/code-action/code-action.handler';
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { AICompletionsService } from './contrib/inline-completions/service/ai-completions.service';
import { RenameSuggestionsService } from './contrib/rename/rename.service';
import { AINativeCoreContribution, IAIMiddleware } from './types';
import { InlineChatEditorContribution } from './widget/inline-chat/inline-chat.contribution';

@Injectable()
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(RenameSuggestionsService)
  private readonly renameSuggestionService: RenameSuggestionsService;

  @Autowired(InlineChatEditorContribution)
  private readonly inlineChatEditorContribution: InlineChatEditorContribution;

  @Autowired(CodeActionHandler)
  private readonly codeActionHandler: CodeActionHandler;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired()
  private monacoTelemetryService: MonacoTelemetryService;

  private latestMiddlewareCollector: IAIMiddleware;

  private logger: ILogServiceClient;

  constructor() {
    super();

    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  private modelSessionDisposable: Disposable;
  private initialized: boolean = false;

  dispose(): void {
    super.dispose();
    this.initialized = false;
    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }
  }

  contribute(editor: IEditor): IDisposable {
    if (!(editor instanceof BrowserCodeEditor) || this.initialized) {
      return this;
    }

    this.disposables.push(
      editor.onRefOpen((e) => {
        const { uri } = e.instance;
        if (uri.codeUri.scheme !== Schemes.file || this.initialized) {
          return;
        }

        this.initialized = true;
        this.contributeInlineCompletionFeature(editor);
        this.registerLanguageFeatures(editor);

        this.addDispose(this.inlineChatEditorContribution.contribute(editor));
      }),
    );

    const { monacoEditor } = editor;

    this.disposables.push(
      monacoEditor.onDidScrollChange(() => {
        if (this.ctxMenuRenderer.visible) {
          this.ctxMenuRenderer.hide(true);
        }
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
      }),
      monacoEditor.onDidBlurEditorText(() => {
        this.aiCompletionsService.hideStatusBarItem();
        this.aiCompletionsService.setVisibleCompletion(false);
      }),
    );
  }

  shouldAbortRequest(model: monaco.ITextModel) {
    if (model.uri.scheme !== Schemes.file) {
      return true;
    }

    return false;
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
        this.modelSessionDisposable.addDispose(this.codeActionHandler.registerCodeActionFeature(languageId, editor));
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
}
