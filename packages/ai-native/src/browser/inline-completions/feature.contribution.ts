import debounce from 'lodash/debounce';

import * as monaco from '@opensumi/ide-monaco';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { ContributionProvider, Disposable, Event, IDisposable, IEventBus, ILoggerManagerClient, ILogServiceClient, SupportLogNamespace } from '@opensumi/ide-core-common';
import { EditorSelectionChangeEvent, IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser/types';
import { AIInlineCompletionsProvider } from './completeProvider';
import { AICompletionsService } from './service/ai-completions.service';
import { AINativeCoreContribution, IAIMiddleware } from '../types';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api/index';
import { Schemes } from '@opensumi/ide-core-common';

@Injectable()
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(AICompletionsService)
  private readonly aiCompletionsService: AICompletionsService;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  private latestMiddlewareCollector: IAIMiddleware;
  private modelSessionDisposable: Disposable;

  contribute(editor: IEditor): IDisposable {
    if (!editor) {
      return this;
    }

    const { monacoEditor, currentUri } = editor;
    if (this.shouldAbortRequest(monacoEditor.getModel())) {
      return this;
    }

    this.registerLanguageFeatures(editor);
    return this;
  }

  private shouldAbortRequest(model: monaco.ITextModel | null) {
    if (!model || (model.uri.scheme !== Schemes.file)) {
      return true;
    }

    return false;
  }

  protected contributeInlineCompletionFeature(editor: IEditor): void {
    const { monacoEditor } = editor;
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

  private async registerLanguageFeatures(editor: IEditor): Promise<void> {
    const { monacoEditor } = editor;

    this.disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
        (_, e) => e,
        300,
      )(() => {
        if (!this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
          return;
        }

        if (this.modelSessionDisposable) {
          this.modelSessionDisposable.dispose();
        }

        const model = monacoEditor.getModel();
        if (!model) {
          return;
        }

        const languageId = model.getLanguageId();

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

              return list;
            },
            freeInlineCompletions() { },
            handleItemDidShow: (completions) => {
              if (completions.items.length > 0) {
                this.aiCompletionsService.setVisibleCompletion(true);
              }
            },
          }),
        );
      }))
  }
}