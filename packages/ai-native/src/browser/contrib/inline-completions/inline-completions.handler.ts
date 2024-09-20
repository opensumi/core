import debounce from 'lodash/debounce';

import { Autowired, Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-browser';
import { AI_INLINE_COMPLETION_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  CommandService,
  CommandServiceImpl,
  Disposable,
  IEventBus,
  Sequencer,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { EditorSelectionChangeEvent, IEditor } from '@opensumi/ide-editor/lib/browser';
import { ICodeEditor, InlineCompletions, Position, Range } from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { InlineCompletionContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletionContextKeys';

import { BaseAIMonacoContribHandler } from '../base';
import { IIntelligentCompletionsResult } from '../intelligent-completions/intelligent-completions';

import { AIInlineCompletionsProvider } from './completeProvider';
import { AICompletionsService } from './service/ai-completions.service';

@Injectable()
export class InlineCompletionSingleHandler extends BaseAIMonacoContribHandler {
  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService: CommandServiceImpl;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  private sequencer = new Sequencer();
  private preDidShowItems: InlineCompletions | undefined;

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
      monacoEditor.onDidBlurEditorText(() => {
        this.commandService.executeCommand(AI_INLINE_COMPLETION_VISIBLE.id, false);
      }),
    );

    return this;
  }

  mountEditor(monacoEditor: ICodeEditor) {
    const toDispose = new Disposable();
    this.aiInlineCompletionsProvider.mount();

    toDispose.addDispose(super.mountEditor(monacoEditor));
    toDispose.addDispose(this.aiInlineCompletionsProvider);

    const inlineVisibleKey = new Set([InlineCompletionContextKeys.inlineSuggestionVisible.key]);
    toDispose.addDispose(
      monacoEditor.contextKeyService.onDidChangeContext((e) => {
        // inline completion 真正消失时
        if (e.affectsSome(inlineVisibleKey)) {
          const inlineSuggestionVisible = InlineCompletionContextKeys.inlineSuggestionVisible.getValue(
            monacoEditor.contextKeyService,
          );
          if (!inlineSuggestionVisible && this.preDidShowItems) {
            runWhenIdle(() => {
              this.preDidShowItems = undefined;
              this.commandService.executeCommand(AI_INLINE_COMPLETION_VISIBLE.id, false);
            });
          }
        }
      }),
    );
    return toDispose;
  }

  doContribute(): IDisposable {
    let prePosition: Position | undefined;

    return monacoApi.languages.registerInlineCompletionsProvider('*', {
      groupId: 'ai-native-inline-completions',
      provideInlineCompletions: async (model, position, context, token) => {
        if (!this.shouldHandle(model.uri)) {
          return;
        }

        /**
         * 如果新字符在 inline completion 的 ghost text 内，则走缓存，不重新请求
         */
        if (this.preDidShowItems) {
          if (!prePosition) {
            prePosition = position.delta(0, -1);
          }

          const lineBefore = model.getValueInRange(Range.fromPositions(prePosition, position));
          if (this.preDidShowItems.items[0].insertText.toString().startsWith(lineBefore)) {
            return this.preDidShowItems;
          } else {
            prePosition = undefined;
          }
        }

        const completionsResult: IIntelligentCompletionsResult = await this.sequencer.queue(() =>
          this.aiInlineCompletionsProvider.provideInlineCompletionItems(model, position, context, token),
        );

        return completionsResult;
      },
      freeInlineCompletions() {},
      handleItemDidShow: (completions) => {
        if (completions.items.length > 0) {
          this.preDidShowItems = completions;
          this.aiCompletionsService.setVisibleCompletion(true);
        }
      },
    });
  }
}
