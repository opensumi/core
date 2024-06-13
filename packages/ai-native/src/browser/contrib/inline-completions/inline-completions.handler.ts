import debounce from 'lodash/debounce';

import { Autowired, Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-browser';
import { Disposable, IEventBus, Sequencer } from '@opensumi/ide-core-common';
import { EditorSelectionChangeEvent, IEditor } from '@opensumi/ide-editor/lib/browser';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { IAIMiddleware } from '../../types';
import { IAIMonacoContribHandler } from '../base';

import { AIInlineCompletionsProvider } from './completeProvider';
import { AICompletionsService } from './service/ai-completions.service';

@Injectable()
export class InlineCompletionHandler extends IAIMonacoContribHandler {
  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

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

  updateConfig(middlewares: IAIMiddleware[]) {
    const middleware = middlewares[middlewares.length - 1];
    if (!middleware) {
      return;
    }

    // currently only support one middleware
    if (middleware?.language?.provideInlineCompletions) {
      this.aiCompletionsService.setMiddlewareComplete(middleware?.language?.provideInlineCompletions);
    }
  }

  mountEditor(editor: IEditor) {
    const toDispose = new Disposable();
    this.aiInlineCompletionsProvider.mountEditor(editor);
    toDispose.addDispose(this.aiInlineCompletionsProvider);
    toDispose.addDispose(super.mountEditor(editor));
    return toDispose;
  }

  doContribute(): IDisposable {
    const sequencer = new Sequencer();

    return monacoApi.languages.registerInlineCompletionsProvider('*', {
      groupId: 'ai-native-inline-completions',
      provideInlineCompletions: async (model, position, context, token) => {
        const needStop = this.intercept(model.uri);
        if (needStop) {
          return;
        }

        const list = await sequencer.queue(() =>
          this.aiInlineCompletionsProvider.provideInlineCompletionItems(model, position, context, token),
        );

        return list;
      },
      freeInlineCompletions() {},
      handleItemDidShow: (completions) => {
        if (completions.items.length > 0) {
          this.aiCompletionsService.setVisibleCompletion(true);
        }
      },
    });
  }
}
