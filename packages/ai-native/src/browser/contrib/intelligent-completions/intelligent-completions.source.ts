import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import { AI_INLINE_COMPLETION_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  CommandService,
  CommandServiceImpl,
  Disposable,
  IDisposable,
  IEventBus,
  Sequencer,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { EditorSelectionChangeEvent } from '@opensumi/ide-editor/lib/browser';
import { ICodeEditor, InlineCompletions, Position, Range } from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { InlineCompletionContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletionContextKeys';

import { IAIInlineCompletionsProvider } from '../../../common';

import { IIntelligentCompletionsResult } from './intelligent-completions';

@Injectable({ multiple: true })
export class InlineCompletionsSource extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService: CommandServiceImpl;

  @Autowired(IAIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: IAIInlineCompletionsProvider;

  private sequencer = new Sequencer();
  private preDidShowItems: InlineCompletions | undefined;

  constructor(@Optional() private readonly monacoEditor: ICodeEditor) {
    super();

    // 判断用户是否选择了一块区域或者移动光标 取消掉请补全请求
    const selectionChange = () => {
      this.aiInlineCompletionsProvider.hideStatusBarItem();
      const selection = this.monacoEditor.getSelection();
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

    const inlineVisibleKey = new Set([InlineCompletionContextKeys.inlineSuggestionVisible.key]);
    this.addDispose(
      this.monacoEditor.contextKeyService.onDidChangeContext((e) => {
        // inline completion 真正消失时
        if (e.affectsSome(inlineVisibleKey)) {
          const inlineSuggestionVisible = InlineCompletionContextKeys.inlineSuggestionVisible.getValue(
            this.monacoEditor.contextKeyService,
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

    this.addDispose(
      this.eventBus.on(EditorSelectionChangeEvent, (e) => {
        if (e.payload.source === 'mouse') {
          debouncedSelectionChange();
        } else {
          debouncedSelectionChange.cancel();
          selectionChange();
        }
      }),
    );

    this.addDispose(
      this.monacoEditor.onDidChangeModelContent((e) => {
        const changes = e.changes;
        for (const change of changes) {
          if (change.text === empty) {
            this.aiInlineCompletionsProvider.isDelEvent = true;
            this.aiInlineCompletionsProvider.cancelRequest();
          } else {
            this.aiInlineCompletionsProvider.isDelEvent = false;
          }
        }
      }),
    );

    this.addDispose(
      this.monacoEditor.onDidBlurEditorText(() => {
        this.commandService.executeCommand(AI_INLINE_COMPLETION_VISIBLE.id, false);
      }),
    );
  }

  public fetch(): IDisposable {
    let prePosition: Position | undefined;

    this.addDispose(
      monacoApi.languages.registerInlineCompletionsProvider('*', {
        groupId: 'ai-native-intelligent-completions',
        provideInlineCompletions: async (model, position, context, token) => {
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
            this.aiInlineCompletionsProvider.setVisibleCompletion(true);
          }
        },
      }),
    );

    return this;
  }
}
