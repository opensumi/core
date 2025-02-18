import {
  ContextKeyChangeEvent,
  Key,
  KeybindingRegistry,
  KeybindingScope,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { MultiLineEditsIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import {
  AINativeSettingSectionsId,
  CodeEditsRT,
  Disposable,
  Event,
  IDisposable,
  ILogger,
  IntelligentCompletionsRegistryToken,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { Emitter, ICodeEditor, ICursorPositionChangedEvent, IRange, ITextModel, Range } from '@opensumi/ide-monaco';
import {
  IObservable,
  IObservableSignal,
  ISettableObservable,
  ITransaction,
  autorun,
  autorunWithStoreHandleChanges,
  derived,
  derivedHandleChanges,
  derivedOpts,
  observableFromEvent,
  observableSignal,
  observableValue,
  transaction,
} from '@opensumi/ide-monaco/lib/common/observable';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { EditorContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { inlineSuggestCommitId } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/controller/commandIds';
import { InlineCompletionContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/controller/inlineCompletionContextKeys';
import { InlineCompletionsController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController';
import {
  SuggestItemInfo,
  SuggestWidgetAdaptor,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/model/suggestWidgetAdapter';
import { ContextKeyExpr } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { REWRITE_DECORATION_INLINE_ADD, RewriteWidget } from '../../widget/rewrite/rewrite-widget';
import { BaseAIMonacoEditorController } from '../base';

import { AdditionsDeletionsDecorationModel } from './decoration/additions-deletions.decoration';
import { MultiLineDecorationModel } from './decoration/multi-line.decoration';
import {
  IMultiLineDiffChangeResult,
  computeMultiLineDiffChanges,
  mergeMultiLineDiffChanges,
  wordChangesToLineChangesMap,
} from './diff-computer';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';
import { CodeEditsSourceCollection } from './source/base';
import { LineChangeCodeEditsSource } from './source/line-change.source';
import { LintErrorCodeEditsSource } from './source/lint-error.source';
import { TypingCodeEditsSource } from './source/typing.source';

import { CodeEditsResultValue, VALID_TIME } from './index';

export class IntelligentCompletionsController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.intelligent.completions';

  public static get(editor: ICodeEditor): IntelligentCompletionsController | null {
    return editor.getContribution<IntelligentCompletionsController>(IntelligentCompletionsController.ID);
  }

  private get model(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  private get preferenceService(): PreferenceService {
    return this.injector.get(PreferenceService);
  }

  private get keybindingRegistry(): KeybindingRegistry {
    return this.injector.get(KeybindingRegistry);
  }

  private get intelligentCompletionsRegistry(): IntelligentCompletionsRegistry {
    return this.injector.get(IntelligentCompletionsRegistryToken);
  }

  private get logger(): ILogger {
    return this.injector.get(ILogger);
  }

  private codeEditsResult: ISettableObservable<CodeEditsResultValue | undefined>;
  private multiLineDecorationModel: MultiLineDecorationModel;
  private additionsDeletionsDecorationModel: AdditionsDeletionsDecorationModel;
  private codeEditsSourceCollection: CodeEditsSourceCollection;
  private aiNativeContextKey: AINativeContextKey;
  private rewriteWidget: RewriteWidget | null;
  private codeEditsTriggerSignal: IObservableSignal<void>;
  private multiLineEditsIsVisibleObs: IObservable<boolean>;

  public mount(): IDisposable {
    this.handlerAlwaysVisiblePreference();

    this.codeEditsResult = observableValue<CodeEditsResultValue | undefined>(this, undefined);
    this.codeEditsTriggerSignal = observableSignal(this);

    this.multiLineDecorationModel = new MultiLineDecorationModel(this.monacoEditor);
    this.additionsDeletionsDecorationModel = new AdditionsDeletionsDecorationModel(this.monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);
    this.codeEditsSourceCollection = this.injector.get(CodeEditsSourceCollection, [
      [LintErrorCodeEditsSource, LineChangeCodeEditsSource, TypingCodeEditsSource],
      this.monacoEditor,
    ]);

    const multiLineEditsIsVisibleKey = new Set([MultiLineEditsIsVisible.raw]);
    this.multiLineEditsIsVisibleObs = observableFromEvent(
      this,
      Event.filter(this.aiNativeContextKey.contextKeyService!.onDidChangeContext, (e: ContextKeyChangeEvent) =>
        e.payload.affectsSome(multiLineEditsIsVisibleKey),
      ),
      () => !!this.aiNativeContextKey.multiLineEditsIsVisible.get(),
    );

    this.registerFeature(this.monacoEditor);
    return this.featureDisposable;
  }

  private handlerAlwaysVisiblePreference(): void {
    let observableDisposable = new Disposable();

    const register = () => {
      /**
       * by: https://github.com/microsoft/vscode/blob/release/1.87/src/vs/editor/contrib/inlineCompletions/browser/commands.ts#L136
       * 修改了原生的 inline completion 的 tab keybinding when 条件，使其不受 suggest 的影响
       */
      observableDisposable.addDispose(
        this.keybindingRegistry.registerKeybinding(
          {
            command: inlineSuggestCommitId,
            keybinding: Key.TAB.code,
            when: ContextKeyExpr.and(
              InlineCompletionContextKeys.inlineSuggestionVisible,
              EditorContextKeys.tabMovesFocus.toNegated(),
              InlineCompletionContextKeys.inlineSuggestionHasIndentationLessThanTabSize,
              // SuggestContext.Visible.toNegated(), // 只去除了这个 when 条件
              EditorContextKeys.hoverFocused.toNegated(),
            ),
          },
          KeybindingScope.USER,
        ),
      );

      const inlineCompletionsController = InlineCompletionsController.get(this.monacoEditor);
      if (inlineCompletionsController) {
        observableDisposable.addDispose(
          autorun((reader) => {
            /**
             * https://github.com/microsoft/vscode/blob/1.88.1/src/vs/editor/contrib/inlineCompletions/browser/suggestWidgetInlineCompletionProvider.ts#L23
             * SuggestWidgetAdaptor 是 inline completions 模块专门用来处理 suggest widget 的适配器
             * 主要控制当下拉补全出现时阴影字符串的显示与隐藏
             * 当 selectedItem 有值的时候（也就是选中下拉补全列表项时），会把原来的 inline completions 本身的阴影字符给屏蔽掉
             * 所以可以利用这点，把 selectedItem 重新置为空即可
             */
            const model = inlineCompletionsController.model.read(reader);
            model?.inlineCompletionState.read(reader);

            const suggestWidgetSelectedItem = inlineCompletionsController['_suggestWidgetSelectedItem'] as IObservable<
              SuggestItemInfo | undefined
            >;
            const selectedItem = suggestWidgetSelectedItem.get();
            if (selectedItem) {
              const suggestWidgetAdaptor = inlineCompletionsController['_suggestWidgetAdaptor'] as SuggestWidgetAdaptor;
              suggestWidgetAdaptor['_currentSuggestItemInfo'] = undefined;
              (suggestWidgetAdaptor['_onDidSelectedItemChange'] as Emitter<void>).fire();
            }
          }),
        );
      }
    };

    const unregister = () => {
      if (observableDisposable) {
        observableDisposable.dispose();
        observableDisposable = new Disposable();
      }
    };

    const isAlwaysVisible = this.preferenceService.getValid(
      AINativeSettingSectionsId.IntelligentCompletionsAlwaysVisible,
      true,
    );

    if (isAlwaysVisible) {
      register();
    }

    this.featureDisposable.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.IntelligentCompletionsAlwaysVisible,
        ({ newValue }) => {
          if (newValue) {
            register();
          } else {
            unregister();
          }
        },
      ),
    );
  }

  private destroyRewriteWidget() {
    if (this.rewriteWidget) {
      this.rewriteWidget.dispose();
      this.rewriteWidget = null;
    }
  }

  private applyInlineDecorations(completionModel: CodeEditsResultValue) {
    const { items } = completionModel;
    const { range, insertText } = items[0];

    // code edits 必须提供 range
    if (!range) {
      return;
    }

    const position = this.monacoEditor.getPosition()!;
    const model = this.monacoEditor.getModel();
    const insertTextString = insertText.toString();
    const originalContent = model?.getValueInRange(range);
    const eol = this.model.getEOL();

    const changes = computeMultiLineDiffChanges(
      originalContent!,
      insertTextString,
      this.monacoEditor,
      range.startLineNumber,
      eol,
    );

    if (!changes) {
      return;
    }

    const { singleLineCharChanges, charChanges, wordChanges, isOnlyAddingToEachWord } = changes;

    // 限制 changes 数量，超过这个数量直接显示智能重写
    const maxCharChanges = 20;
    const maxWordChanges = 20;

    if (
      range &&
      isOnlyAddingToEachWord &&
      charChanges.length <= maxCharChanges &&
      wordChanges.length <= maxWordChanges
    ) {
      const modificationsResult = this.multiLineDecorationModel.applyInlineDecorations(
        this.monacoEditor,
        mergeMultiLineDiffChanges(singleLineCharChanges, eol),
        range.startLineNumber,
        position,
      );

      this.aiNativeContextKey.multiLineEditsIsVisible.reset();
      this.multiLineDecorationModel.clearDecorations();

      if (!modificationsResult) {
        this.renderRewriteWidget(wordChanges, model, range, insertTextString);
      } else if (modificationsResult && modificationsResult.inlineMods) {
        this.aiNativeContextKey.multiLineEditsIsVisible.set(true);
        this.multiLineDecorationModel.updateLineModificationDecorations(modificationsResult.inlineMods);
      }
    } else {
      this.additionsDeletionsDecorationModel.updateDeletionsDecoration(wordChanges, range, eol);
      this.renderRewriteWidget(wordChanges, model, range, insertTextString);
    }
  }

  private async renderRewriteWidget(
    wordChanges: IMultiLineDiffChangeResult[],
    model: ITextModel | null,
    range: IRange,
    insertTextString: string,
  ) {
    this.destroyRewriteWidget();

    const cursorPosition = this.monacoEditor.getPosition();
    if (!cursorPosition) {
      return;
    }

    this.rewriteWidget = this.injector.get(RewriteWidget, [this.monacoEditor]);

    const startOffset = this.model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const endOffset = this.model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
    const allText = this.model.getValue();
    // 这里是为了能在 rewrite widget 的 editor 当中完整的复用代码高亮与语法检测的能力
    const newVirtualContent = allText.substring(0, startOffset) + insertTextString + allText.substring(endOffset);

    const lineChangesMap = wordChangesToLineChangesMap(wordChanges, range, model);

    await this.rewriteWidget.defered.promise;

    this.aiNativeContextKey.multiLineEditsIsVisible.set(true);

    const allLineChanges = Object.values(lineChangesMap).map((lineChanges) => ({
      changes: lineChanges
        .map((change) => change.filter((item) => item.value.trim() !== empty))
        .filter((change) => change.length > 0),
    }));

    this.rewriteWidget.setInsertText(insertTextString);
    this.rewriteWidget.show({ position: cursorPosition });
    this.rewriteWidget.setEditArea(range);

    if (allLineChanges.every(({ changes }) => changes.every((change) => change.every(({ removed }) => removed)))) {
      // 处理全是删除的情况
      this.rewriteWidget.renderTextLineThrough(allLineChanges);
    } else {
      this.rewriteWidget.renderVirtualEditor(newVirtualContent, wordChanges);
    }
  }

  public hide() {
    this.cancelToken();
    this.aiNativeContextKey.multiLineEditsIsVisible.reset();
    this.multiLineDecorationModel.clearDecorations();
    this.additionsDeletionsDecorationModel.clearDeletionsDecorations();
    this.destroyRewriteWidget();
  }

  private readonly reportData = derived(this, (reader) => {
    const contextBean = this.codeEditsSourceCollection.codeEditsContextBean.read(reader);
    const codeEditsResult = this.codeEditsResult.read(reader);
    if (contextBean && codeEditsResult) {
      const { range, insertText } = codeEditsResult.items[0];
      const newCode = insertText;
      const originCode = this.model.getValueInRange(range);
      return (type: keyof Pick<CodeEditsRT, 'isReceive' | 'isDrop' | 'isValid'>, defaultValue: boolean = true) => {
        const data = {
          [type]: defaultValue,
          code: newCode,
          originCode,
        };

        contextBean.reporterEnd(data);
      };
    }
  });

  public discard = derivedHandleChanges(
    {
      owner: this,
      createEmptyChangeSummary: () => ({ lastVisibleTime: Date.now() }),
      handleChange: (context, changeSummary) => {
        if (context.didChange(this.multiLineEditsIsVisibleObs)) {
          changeSummary.lastVisibleTime = Date.now();
          return this.multiLineEditsIsVisibleObs.get();
        }
        return false;
      },
      equalityComparer: () => false,
    },
    (reader, changeSummary) => {
      this.multiLineEditsIsVisibleObs.read(reader);

      const lastVisibleTime = changeSummary.lastVisibleTime;
      const report = this.reportData.read(reader);
      let isValid = false;

      if (lastVisibleTime && Date.now() - lastVisibleTime > VALID_TIME) {
        isValid = true;
        report?.('isDrop');
      } else {
        isValid = false;
        report?.('isValid', false);
      }

      this.hide();
      return isValid;
    },
  );

  public accept = derivedOpts({ owner: this, equalsFn: () => false }, (reader) => {
    const report = this.reportData.read(reader);
    report?.('isReceive');

    this.multiLineDecorationModel.accept();

    if (this.rewriteWidget) {
      this.rewriteWidget.accept();

      const virtualEditor = this.rewriteWidget.getVirtualEditor();
      // 采纳完之后将 virtualEditor 的 decorations 重新映射在 editor 上
      if (virtualEditor) {
        const editArea = this.rewriteWidget.getEditArea();
        const decorations = virtualEditor.getDecorationsInRange(Range.lift(editArea));
        const preAddedDecorations = decorations?.filter(
          (decoration) => decoration.options.description === REWRITE_DECORATION_INLINE_ADD,
        );
        if (preAddedDecorations) {
          this.additionsDeletionsDecorationModel.updateAdditionsDecoration(
            preAddedDecorations.map((decoration) => decoration.range),
          );
        }
      }
    }

    this.hide();
  });

  public trigger(tx: ITransaction): void {
    this.codeEditsTriggerSignal.trigger(tx);
  }

  private registerFeature(monacoEditor: ICodeEditor): void {
    this.featureDisposable.addDispose(
      Event.any<any>(
        monacoEditor.onDidChangeCursorPosition,
        monacoEditor.onDidChangeModelContent,
        monacoEditor.onDidBlurEditorWidget,
      )(() => {
        this.additionsDeletionsDecorationModel.clearAdditionsDecorations();
      }),
    );

    // 监听当前光标位置的变化，如果超出 range 区域则表示弃用
    this.featureDisposable.addDispose(
      this.monacoEditor.onDidChangeCursorPosition((event: ICursorPositionChangedEvent) => {
        const isVisible = this.multiLineEditsIsVisibleObs.get();
        const completionModel = this.codeEditsResult.get();

        if (isVisible && completionModel) {
          const position = event.position;
          const range = completionModel.items[0].range;
          if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) {
            runWhenIdle(() => {
              this.discard.get();
            });
          }
        }
      }),
    );

    this.featureDisposable.addDispose(
      Event.any<any>(
        monacoEditor.onDidChangeModel,
        monacoEditor.onDidChangeModelContent,
      )(() => {
        runWhenIdle(() => {
          this.hide();
        });
      }),
    );

    this.featureDisposable.addDispose(
      autorunWithStoreHandleChanges(
        {
          createEmptyChangeSummary: () => ({}),
          handleChange: (context) => {
            if (context.didChange(this.codeEditsSourceCollection.codeEditsContextBean)) {
              // 如果上一次补全结果还在，则不重复请求
              const isVisible = this.aiNativeContextKey.multiLineEditsIsVisible.get();
              return !isVisible;
            } else if (context.didChange(this.codeEditsTriggerSignal)) {
              return true;
            }
            return false;
          },
        },
        async (reader, _, store) => {
          this.codeEditsTriggerSignal.read(reader);
          const context = this.codeEditsSourceCollection.codeEditsContextBean.read(reader);

          const provider = this.intelligentCompletionsRegistry.getCodeEditsProvider();
          if (context && provider) {
            // 新的请求进来且上一次的请求还在继续时，则取消掉上一次的请求
            store.add(Disposable.create(() => context.cancelToken()));

            context.reporterStart();

            const result = await provider(this.monacoEditor, context.position, context.bean, context.token);

            if (result && result.items.length > 0) {
              transaction((tx) => {
                this.codeEditsResult.set(new CodeEditsResultValue(result), tx);
              });
            }
          }
        },
      ),
    );

    this.featureDisposable.addDispose(
      autorun((reader) => {
        const completionModel = this.codeEditsResult.read(reader);
        if (!completionModel) {
          return;
        }

        try {
          this.applyInlineDecorations(completionModel);
        } catch (error) {
          this.logger.warn('IntelligentCompletionsController applyInlineDecorations error', error);
        }
      }),
    );

    this.featureDisposable.addDispose(this.codeEditsSourceCollection);
  }
}
