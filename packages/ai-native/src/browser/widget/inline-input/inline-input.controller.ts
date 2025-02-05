import { Injectable } from '@opensumi/di';
import {
  CancelResponse,
  Disposable,
  Event,
  FRAME_THREE,
  IAIReporter,
  IDisposable,
  ReplyResponse,
  RunOnceScheduler,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { BaseAIMonacoEditorController } from '../../contrib/base';
import { ERunStrategy } from '../../types';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { InlineChatEditorController } from '../inline-chat/inline-chat-editor.controller';
import { EInlineChatStatus, EResultKind } from '../inline-chat/inline-chat.service';
import { InlineDiffController } from '../inline-diff';
import { InlineInputPreviewDecorationID } from '../internal.type';


import { InlineInputChatWidget } from './inline-input-widget';
import styles from './inline-input.module.less';
import { InlineInputService } from './inline-input.service';

@Injectable()
export class InlineInputController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.input';

  public static get(editor: ICodeEditor): InlineInputController | null {
    return editor.getContribution<InlineInputController>(InlineInputController.ID);
  }

  private get inlineInputService(): InlineInputService {
    return this.injector.get(InlineInputService);
  }

  private get aiReporter(): IAIReporter {
    return this.injector.get(IAIReporter);
  }

  private inlineDiffController: InlineDiffController;
  private inputDisposable: Disposable;
  private aiNativeContextKey: AINativeContextKey;

  mount(): IDisposable {
    this.inputDisposable = new Disposable();
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);
    this.inlineDiffController = InlineDiffController.get(this.monacoEditor)!;

    this.featureDisposable.addDispose(
      Event.any<any>(
        this.inlineInputService.onHidden,
        this.monacoEditor.onWillChangeModel,
      )(() => {
        this.hideInput();
      }),
    );

    this.featureDisposable.addDispose(
      this.inlineInputService.onInteractiveInputVisibleInPosition(async (position) => {
        if (position) {
          if (this.inputDisposable) {
            this.inputDisposable.dispose();
            this.inputDisposable = new Disposable();
          }

          this.showInputInEmptyLine(position, this.monacoEditor);
        } else {
          setTimeout(() => this.monacoEditor.focus(), 0);
        }
      }),
    );

    this.featureDisposable.addDispose(
      this.inlineInputService.onInteractiveInputVisibleInSelection((selection) => {
        if (!selection) {
          return;
        }

        if (this.inputDisposable) {
          this.inputDisposable.dispose();
          this.inputDisposable = new Disposable();
        }

        this.showInputInSelection(selection, this.monacoEditor);
      }),
    );

    this.featureDisposable.addDispose(this.inputDisposable);

    return this.featureDisposable;
  }

  private hideInput() {
    this.inputDisposable.dispose();
  }

  private async showInputInEmptyLine(position: monaco.IPosition, monacoEditor: ICodeEditor) {
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

    const collection = monacoEditor.createDecorationsCollection();
    const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor]);

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
      this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);
    }

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onDispose(() => {
        this.cancelToken();
        collection.clear();
        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onResultClick(async (kind: EResultKind) => {
        const clear = () => {
          const curPosi = collection.getRange(0)!;

          model.pushStackElement();
          model.pushEditOperations(null, [EditOperation.delete(curPosi)], () => null);
          model.pushStackElement();
        };

        switch (kind) {
          case EResultKind.ACCEPT:
            this.hideInput();
            break;
          case EResultKind.DISCARD:
            clear();
            this.hideInput();
            break;
          case EResultKind.REGENERATE:
            clear();
            await this.doRequestReadable(
              inlineInputChatWidget.interactiveInputValue,
              inlineInputChatWidget,
              monacoEditor,
              this.inputDisposable,
              collection,
            );
            break;

          default:
            break;
        }
      }),
    );

    this.inputDisposable.addDispose(
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

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onInteractiveInputValue(async (value) => {
        await this.doRequestReadable(value, inlineInputChatWidget, monacoEditor, this.inputDisposable, collection);
      }),
    );

    this.inputDisposable.addDispose(inlineInputChatWidget);
  }

  private async showInputInSelection(selection: monaco.Selection, monacoEditor: ICodeEditor) {
    const inlineChatEditorController = InlineChatEditorController.get(monacoEditor);
    if (!inlineChatEditorController) {
      return;
    }

    monacoEditor.setSelection(selection);

    const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor]);
    inlineInputChatWidget.show({ selection });

    this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);

    this.inlineDiffController.destroyPreviewer(monacoEditor.getModel()?.uri.toString());

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onDispose(() => {
        this.cancelToken();
        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onInteractiveInputValue(async (value) => {
        const handler = this.inlineInputService.getInteractiveInputHandler();

        if (!handler) {
          return;
        }

        inlineInputChatWidget.launchChatStatus(EInlineChatStatus.THINKING);

        const strategy = await this.inlineInputService.getInteractiveInputStrategyHandler()(monacoEditor, value);

        const crossSelection = selection
          .setStartPosition(selection.startLineNumber, 1)
          .setEndPosition(selection.endLineNumber, monacoEditor.getModel()!.getLineMaxColumn(selection.endLineNumber));

        if (strategy === ERunStrategy.PREVIEW && handler.providePreviewStrategy) {
          const previewResponse = await handler.providePreviewStrategy(monacoEditor, value, this.token);

          if (CancelResponse.is(previewResponse)) {
            inlineInputChatWidget.launchChatStatus(EInlineChatStatus.READY);
            this.hideInput();
            return;
          }

          if (InlineChatController.is(previewResponse)) {
            const chatResponse = previewResponse;

            this.inputDisposable.addDispose([
              chatResponse.onError((error) => {
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.ERROR);
              }),
              chatResponse.onAbort(() => {
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.READY);
              }),
              chatResponse.onEnd(() => {
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
            ]);

            chatResponse.listen();

            const diffPreviewer = this.inlineDiffController.showPreviewerByStream(monacoEditor, {
              crossSelection,
              chatResponse,
            });
            diffPreviewer.mount(inlineInputChatWidget);
          }
        } else {
          inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onResultClick((kind: EResultKind) => {
        this.inlineDiffController.handleAction(kind);

        switch (kind) {
          case EResultKind.ACCEPT:
            this.hideInput();
            break;
          case EResultKind.DISCARD:
            this.hideInput();
            break;
          case EResultKind.REGENERATE:
            break;

          default:
            break;
        }
      }),
    );

    this.inputDisposable.addDispose(inlineInputChatWidget);
  }

  private async doRequestReadable(
    value: string,
    widget: InlineInputChatWidget,
    monacoEditor: ICodeEditor,
    inputDisposable: Disposable,
    decoration: monaco.editor.IEditorDecorationsCollection,
  ): Promise<void> {
    const handler = this.inlineInputService.getInteractiveInputHandler();
    const model = monacoEditor.getModel();

    if (!handler || !model) {
      return;
    }

    widget.launchChatStatus(EInlineChatStatus.THINKING);

    const strategy = await this.inlineInputService.getInteractiveInputStrategyHandler()(monacoEditor, value);

    if (strategy === ERunStrategy.EXECUTE && handler.execute) {
      handler.execute(monacoEditor, value, this.token);
      widget.launchChatStatus(EInlineChatStatus.DONE);
      this.hideInput();
      return;
    }

    if (strategy === ERunStrategy.PREVIEW && handler.providePreviewStrategy) {
      const previewResponse = await handler.providePreviewStrategy(monacoEditor, value, this.token);

      if (CancelResponse.is(previewResponse)) {
        widget.launchChatStatus(EInlineChatStatus.READY);
        this.hideInput();
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
}
