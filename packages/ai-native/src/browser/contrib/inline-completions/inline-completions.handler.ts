import debounce from 'lodash/debounce';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-browser';
import { IEventBus, Schemes } from '@opensumi/ide-core-common';
import { EditorSelectionChangeEvent, IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { IAIMiddleware } from '../../types';

import { AIInlineCompletionsProvider } from './completeProvider';
import { AICompletionsService } from './service/ai-completions.service';

@Injectable()
export class InlineCompletionHandler extends Disposable {
  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  private shouldAbortRequest(model: monaco.ITextModel) {
    if (model.uri.scheme !== Schemes.file) {
      return true;
    }

    return false;
  }

  public registerInlineCompletionFeature(editor: IEditor): IDisposable {
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

    return this;
  }

  public registerProvider(editor: IEditor, languageId: string, middlewareCollector?: IAIMiddleware): IDisposable {
    const disposable = new Disposable();

    this.aiInlineCompletionsProvider.registerEditor(editor);

    disposable.addDispose(this.aiInlineCompletionsProvider);
    disposable.addDispose(
      monacoApi.languages.registerInlineCompletionsProvider(languageId, {
        provideInlineCompletions: async (model, position, context, token) => {
          if (this.shouldAbortRequest(model)) {
            return;
          }

          if (middlewareCollector?.language?.provideInlineCompletions) {
            this.aiCompletionsService.setMiddlewareComplete(middlewareCollector?.language?.provideInlineCompletions);
          }

          const list = await this.aiInlineCompletionsProvider.provideInlineCompletionItems(
            model,
            position,
            context,
            token,
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

    return disposable;
  }
}
