import { Injectable } from '@opensumi/di';
import { IAIInlineChatService } from '@opensumi/ide-core-browser';
import {
  CancelResponse,
  Disposable,
  Event,
  FRAME_THREE,
  IDisposable,
  InlineChatFeatureRegistryToken,
  ReplyResponse,
  RunOnceScheduler,
} from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { BaseAIMonacoEditorController } from '../../contrib/base';
import { LanguageParserService } from '../../languages/service';
import { ERunStrategy } from '../../types';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { InlineChatFeatureRegistry } from '../inline-chat/inline-chat.feature.registry';
import { AIInlineChatService, EInlineChatStatus, EResultKind } from '../inline-chat/inline-chat.service';
import { InlineInputPreviewDecorationID } from '../internal.type';

import { InlineInputChatWidget } from './inline-input-widget';
import styles from './inline-input.module.less';
import { InlineInputChatService } from './inline-input.service';

@Injectable()
export class InlineInputController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.input';

  public static get(editor: ICodeEditor): InlineInputController | null {
    return editor.getContribution<InlineInputController>(InlineInputController.ID);
  }

  private get inlineInputChatService(): InlineInputChatService {
    return this.injector.get(InlineInputChatService);
  }

  private get inlineChatFeatureRegistry(): InlineChatFeatureRegistry {
    return this.injector.get(InlineChatFeatureRegistryToken);
  }

  private get languageParserService(): LanguageParserService {
    return this.injector.get(LanguageParserService);
  }

  private get inlineChatService(): AIInlineChatService {
    return this.injector.get(IAIInlineChatService);
  }

  mount(): IDisposable {
    return this.registerInlineInputFeature(this.monacoEditor);
  }

  private async doRequestReadable(
    value: string,
    widget: InlineInputChatWidget,
    monacoEditor: ICodeEditor,
    inputDisposable: Disposable,
    decoration: monaco.editor.IEditorDecorationsCollection,
    hideInput: () => void,
  ): Promise<void> {
    const handler = this.inlineChatFeatureRegistry.getInteractiveInputHandler();
    const model = monacoEditor.getModel();

    if (!handler || !model) {
      return;
    }

    widget.launchChatStatus(EInlineChatStatus.THINKING);

    const strategy = await this.inlineChatFeatureRegistry.getInteractiveInputStrategyHandler()(monacoEditor, value);

    if (strategy === ERunStrategy.EXECUTE && handler.execute) {
      handler.execute(monacoEditor, value, this.token);
      widget.launchChatStatus(EInlineChatStatus.DONE);
      hideInput();
      return;
    }

    if (strategy === ERunStrategy.PREVIEW && handler.providePreviewStrategy) {
      const previewResponse = await handler.providePreviewStrategy(monacoEditor, value, this.token);

      if (CancelResponse.is(previewResponse)) {
        widget.launchChatStatus(EInlineChatStatus.READY);
        hideInput();
        return;
      }

      if (InlineChatController.is(previewResponse)) {
        const controller = previewResponse as InlineChatController;

        let latestContent: string | undefined;
        const schedulerEdit: RunOnceScheduler = this.registerDispose(
          new RunOnceScheduler(() => {
            const range = decoration.getRange(0);
            if (range && latestContent) {
              model.pushEditOperations(null, [EditOperation.replace(range, latestContent)], () => null);
            }
          }, 16 * 12.5),
        );

        inputDisposable.addDispose([
          controller.onData(async (data) => {
            if (!ReplyResponse.is(data)) {
              return;
            }

            latestContent = data.message;

            if (!schedulerEdit.isScheduled()) {
              schedulerEdit.schedule();
            }
          }),
          controller.onError((error) => {
            widget.launchChatStatus(EInlineChatStatus.ERROR);
          }),
          controller.onAbort(() => {
            widget.launchChatStatus(EInlineChatStatus.READY);
          }),
          controller.onEnd(() => {
            model.pushStackElement();
            widget.launchChatStatus(EInlineChatStatus.DONE);
          }),
        ]);

        controller.listen();
      }
    }
  }

  private registerInlineInputFeature(monacoEditor: ICodeEditor): IDisposable {
    const inputDisposable = new Disposable();
    const aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);

    const hideInput = () => {
      inputDisposable.dispose();
    };

    this.featureDisposable.addDispose(
      this.inlineInputChatService.onInteractiveInputVisibleInPosition((position) => {
        hideInput();
        if (position) {
          showInput(position, monacoEditor);
        } else {
          setTimeout(() => {
            monacoEditor.focus();
          }, 0);
        }
      }),
    );

    const showInput = async (position: monaco.Position, monacoEditor: ICodeEditor) => {
      this.featureDisposable.addDispose(
        monacoEditor.onWillChangeModel(() => {
          hideInput();
        }),
      );

      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      /**
       * 只有当前编辑器的光标聚焦，才会展示
       * 用于解决多栏的情况下，同时打开多个 input 的问题
       */
      const hasFocus = monacoEditor.hasTextFocus();
      if (!hasFocus) {
        return;
      }

      const selection = monacoEditor.getSelection();
      if (selection && selection.startLineNumber !== selection.endLineNumber) {
        return;
      }

      const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor]);

      const collection = monacoEditor.createDecorationsCollection();
      const isEmptyLine = !monacoEditor.getModel()?.getLineContent(position.lineNumber).trim();

      if (!isEmptyLine) {
        // 根据光标位置自动检测并选中临近的代码块
        const cursorPosition = monacoEditor.getPosition();
        const editorModel = monacoEditor.getModel();
        const cursor = editorModel?.getOffsetAt(cursorPosition!);
        const language = editorModel?.getLanguageId();
        const parser = this.languageParserService.createParser(language!);
        const codeBlock = await parser?.findNearestCodeBlockWithPosition(editorModel?.getValue() || '', cursor!);

        if (codeBlock) {
          const selection = new monaco.Selection(
            codeBlock.range.start.line + 1,
            codeBlock.range.start.character,
            codeBlock.range.end.line + 1,
            codeBlock.range.end.character,
          );
          monacoEditor.setSelection(selection);
        } else {
          // 选中当前行
          monacoEditor.setSelection(new monaco.Selection(position.lineNumber, 1, position.lineNumber, Infinity));
        }
        this.inlineChatService.launchInputVisible(true);
        return;
      }

      // 仅在空行情况下增加装饰逻辑
      collection.append([
        {
          range: monaco.Range.fromPositions(position),
          options: ModelDecorationOptions.register({
            description: InlineInputPreviewDecorationID,
            isWholeLine: true,
            className: styles.input_decoration_readable_container,
            inlineClassName: styles.inline_chat_inserted_range,
          }),
        },
      ]);

      const decorationRange = collection.getRange(0);
      let preLineRange: LineRange;
      if (decorationRange) {
        preLineRange = LineRange.fromRange(decorationRange);
        inlineInputChatWidget.show({ position: decorationRange.getStartPosition() });
      }
      aiNativeContextKey.inlineInputWidgetIsVisible.set(true);

      inputDisposable.addDispose(
        inlineInputChatWidget.onDispose(() => {
          this.cancelToken();
          collection.clear();
          aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
        }),
      );

      inputDisposable.addDispose(
        inlineInputChatWidget.onResultClick(async (kind: EResultKind) => {
          const clear = () => {
            const curPosi = collection.getRange(0)!;

            model.pushStackElement();
            model.pushEditOperations(null, [EditOperation.delete(curPosi)], () => null);
            model.pushStackElement();
          };

          switch (kind) {
            case EResultKind.ACCEPT:
              hideInput();
              break;
            case EResultKind.DISCARD:
              clear();
              hideInput();
              break;
            case EResultKind.REGENERATE:
              clear();
              await this.doRequestReadable(
                inlineInputChatWidget.interactiveInputValue,
                inlineInputChatWidget,
                monacoEditor,
                inputDisposable,
                collection,
                hideInput,
              );
              break;

            default:
              break;
          }
        }),
      );

      inputDisposable.addDispose(
        Event.debounce(
          collection.onDidChange.bind(collection),
          () => {},
          FRAME_THREE,
        )(() => {
          if (!collection.getRange(0)) {
            return;
          }

          const range = collection.getRange(0)!;
          const curLineRange = LineRange.fromRange(range);
          if (!preLineRange.equals(curLineRange)) {
            inlineInputChatWidget.setOptions({
              position: range.getStartPosition(),
            });

            inlineInputChatWidget.layoutContentWidget();
          }
          preLineRange = curLineRange;
        }),
      );

      inputDisposable.addDispose(
        inlineInputChatWidget.onInteractiveInputValue(async (value) => {
          await this.doRequestReadable(
            value,
            inlineInputChatWidget,
            monacoEditor,
            inputDisposable,
            collection,
            hideInput,
          );
        }),
      );

      inputDisposable.addDispose(inlineInputChatWidget);
    };

    this.featureDisposable.addDispose(inputDisposable);

    return this.featureDisposable;
  }
}
