import { Injectable } from '@opensumi/di';
import {
  CancelResponse,
  Disposable,
  Event,
  FRAME_FIVE,
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

        this.showInputInSelection(selection, this.monacoEditor);
      }),
    );

    this.featureDisposable.addDispose(this.inputDisposable);

    return this.featureDisposable;
  }

  override cancelToken() {
    super.cancelToken();
    this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
  }

  private hideInput() {
    this.inputDisposable.dispose();
  }

  private async showInputInEmptyLine(position: monaco.IPosition, monacoEditor: ICodeEditor, defaultValue?: string) {
    const model = monacoEditor.getModel();

    if (!model) {
      return;
    }

    if (this.inputDisposable) {
      this.inputDisposable.dispose();
      this.inputDisposable = new Disposable();
    }

    const collection = monacoEditor.createDecorationsCollection();
    const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor, defaultValue]);

    let inputValue = defaultValue;

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
            requestAnimationFrame(() => {
              /**
               * 避免在重新生成的时候，因为光标移动，导致 input 的位置不正确
               */
              const curPosi = collection.getRange(0)!;
              const curPosition = curPosi.getStartPosition();
              this.showInputInEmptyLine(curPosition, monacoEditor, inputValue);
            });
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
      inlineInputChatWidget.onClose(() => {
        const isStreaming = this.aiNativeContextKey.inlineInputWidgetIsStreaming.get();
        if (isStreaming) {
          this.cancelToken();
        } else {
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onInteractiveInputValue(async (value) => {
        inputValue = value;
        monacoEditor.focus();

        const handler = this.inlineInputService.getInteractiveInputHandler();
        const model = monacoEditor.getModel();

        if (!handler || !model) {
          return;
        }

        inlineInputChatWidget.launchChatStatus(EInlineChatStatus.THINKING);

        const strategy = await this.inlineInputService.getInteractiveInputStrategyHandler()(monacoEditor, value);

        if (strategy === ERunStrategy.EXECUTE && handler.execute) {
          handler.execute(monacoEditor, value, this.token);
          inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
          this.hideInput();
          return;
        }

        if (strategy === ERunStrategy.PREVIEW && handler.providePreviewStrategy) {
          const previewResponse = await handler.providePreviewStrategy(monacoEditor, value, this.token);

          if (CancelResponse.is(previewResponse)) {
            inlineInputChatWidget.launchChatStatus(EInlineChatStatus.READY);
            this.hideInput();
            return;
          }

          if (InlineChatController.is(previewResponse)) {
            const controller = previewResponse as InlineChatController;

            let latestContent: string | undefined;
            const schedulerEdit: RunOnceScheduler = this.registerDispose(
              new RunOnceScheduler(() => {
                const range = collection.getRange(0);
                if (range && latestContent) {
                  model.pushEditOperations(null, [EditOperation.replace(range, latestContent)], () => null);
                }
              }, FRAME_FIVE),
            );

            this.inputDisposable.addDispose([
              controller.onData(async (data) => {
                if (!ReplyResponse.is(data)) {
                  return;
                }

                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(true);
                latestContent = data.message;

                if (!schedulerEdit.isScheduled()) {
                  schedulerEdit.schedule();
                }
              }),
              controller.onError((error) => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.ERROR);
              }),
              controller.onAbort(() => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                model.pushStackElement();
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
              controller.onEnd(() => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                model.pushStackElement();
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
            ]);

            controller.listen();
          }
        }
      }),
    );

    this.inputDisposable.addDispose(inlineInputChatWidget);
  }

  private async showInputInSelection(selection: monaco.Selection, monacoEditor: ICodeEditor, defaultValue?: string) {
    if (this.inputDisposable) {
      this.inputDisposable.dispose();
      this.inputDisposable = new Disposable();
    }

    monacoEditor.setSelection(selection);

    const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor, defaultValue]);
    inlineInputChatWidget.show({ selection });

    this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);
    this.inlineDiffController.destroyPreviewer(monacoEditor.getModel()?.uri.toString());
    let inputValue = defaultValue;

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onDispose(() => {
        this.cancelToken();
        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onClose(() => {
        const isStreaming = this.aiNativeContextKey.inlineInputWidgetIsStreaming.get();
        if (isStreaming) {
          this.cancelToken();
        } else {
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onInteractiveInputValue(async (value) => {
        inputValue = value;
        monacoEditor.focus();

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
              chatResponse.onData((data) => {
                if (ReplyResponse.is(data)) {
                  this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(true);
                }
              }),
              chatResponse.onError((error) => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.ERROR);
              }),
              chatResponse.onAbort(() => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
              chatResponse.onEnd(() => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
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
          inlineInputChatWidget.launchChatStatus(EInlineChatStatus.READY);
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputChatWidget.onResultClick((kind: EResultKind) => {
        this.inlineDiffController.handleAction(kind);
        this.hideInput();

        if (kind === EResultKind.REGENERATE) {
          requestAnimationFrame(() => {
            this.showInputInSelection(selection, monacoEditor, inputValue);
          });
        }
      }),
    );

    this.inputDisposable.addDispose(inlineInputChatWidget);
  }
}
