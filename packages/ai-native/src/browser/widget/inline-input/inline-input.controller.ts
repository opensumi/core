import { Injectable } from '@opensumi/di';
import {
  CancelResponse,
  Disposable,
  Event,
  FRAME_FIVE,
  FRAME_THREE,
  IAIReporter,
  IDisposable,
  IEventBus,
  ReplyResponse,
  RunOnceScheduler,
  localize,
} from '@opensumi/ide-core-common';
import { EditorGroupCloseEvent } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import {
  IObservable,
  ISettableObservable,
  observableFromEvent,
  observableValue,
} from '@opensumi/ide-monaco/lib/common/observable';
import { MessageService } from '@opensumi/ide-overlay/lib/browser/message.service';
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

import { InlineInputWidget } from './inline-input-widget';
import styles from './inline-input.module.less';
import { InlineInputService } from './inline-input.service';
import { InlineInputWidgetStoreInEmptyLine, InlineInputWidgetStoreInSelection } from './model';
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

  private get eventBus(): IEventBus {
    return this.injector.get(IEventBus);
  }

  private get messageService(): MessageService {
    return this.injector.get(MessageService);
  }

  private inlineDiffController: InlineDiffController;
  private inputDisposable: Disposable;
  private aiNativeContextKey: AINativeContextKey;

  private inputValue: ISettableObservable<string>;
  private modelChangeObs: IObservable<monaco.editor.ITextModel>;
  private inlineInputWidgetStore: Map<
    string,
    InlineInputWidgetStoreInEmptyLine | InlineInputWidgetStoreInSelection | null
  >;

  mount(): IDisposable {
    this.inputDisposable = new Disposable();
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);
    this.inlineDiffController = InlineDiffController.get(this.monacoEditor)!;

    this.inputValue = observableValue(this, '');
    this.modelChangeObs = observableFromEvent<monaco.editor.ITextModel>(
      this,
      this.monacoEditor.onDidChangeModel,
      () => this.monacoEditor.getModel()!,
    );
    this.inlineInputWidgetStore = new Map();

    this.featureDisposable.addDispose(
      /**
       * 如果在流式过程中，直接关闭了当前文件，则需要销毁 diff previewer 并隐藏 input，恢复原始代码
       */
      this.eventBus.on(EditorGroupCloseEvent, (e: EditorGroupCloseEvent) => {
        const isStreaming = this.aiNativeContextKey.inlineInputWidgetIsStreaming.get();
        if (!isStreaming) {
          return;
        }

        const resource = e.payload.resource.uri.toString();
        const currentUri = this.monacoEditor.getModel()?.uri.toString();

        if (currentUri === resource) {
          this.hideInput();

          const message = localize('aiNative.inline.chat.generating.canceled');
          if (message) {
            this.messageService.info(message);
          }
        }
      }),
    );

    this.featureDisposable.addDispose(
      this.inlineInputService.onHidden(() => {
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
    this.inlineInputWidgetStore.delete(this.monacoEditor.getModel()!.id);
    this.inputDisposable.dispose();
  }

  private async showInputInEmptyLine(position: monaco.IPosition, monacoEditor: ICodeEditor, defaultValue?: string) {
    const model = monacoEditor.getModel();

    if (!model) {
      return;
    }

    const selection = monacoEditor.getSelection();
    if (selection && !selection.isEmpty()) {
      return;
    }

    this.inputValue.set(defaultValue || '', undefined);
    this.inlineInputWidgetStore.set(model.id, new InlineInputWidgetStoreInEmptyLine(position, defaultValue));

    if (this.inputDisposable) {
      this.inputDisposable.dispose();
      this.inputDisposable = new Disposable();
    }

    const collection = monacoEditor.createDecorationsCollection();
    const inlineInputWidget = this.injector.get(InlineInputWidget, [monacoEditor, this.inputValue.get()]);

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
      inlineInputWidget.show({ position: decorationRange.getStartPosition() });
      this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);
    }

    this.inputDisposable.addDispose(
      inlineInputWidget.onDispose(() => {
        this.cancelToken();
        collection.clear();
        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onValueChange((value) => {
        this.inputValue.set(value, undefined);

        const storeData = this.inlineInputWidgetStore.get(model.id);
        if (storeData instanceof InlineInputWidgetStoreInEmptyLine) {
          storeData.setValue(value);
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onResultClick(async (kind: EResultKind) => {
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
              this.showInputInEmptyLine(curPosition, monacoEditor, this.inputValue.get());
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
          inlineInputWidget.setOptions({
            position: range.getStartPosition(),
          });

          inlineInputWidget.layoutContentWidget();
        }
        preLineRange = curLineRange;
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onClose(() => {
        const isStreaming = this.aiNativeContextKey.inlineInputWidgetIsStreaming.get();
        if (isStreaming) {
          this.cancelToken();
        } else {
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onSend(async (value) => {
        monacoEditor.focus();

        const handler = this.inlineInputService.getInteractiveInputHandler();
        const model = monacoEditor.getModel();

        if (!handler || !model) {
          return;
        }

        inlineInputWidget.launchChatStatus(EInlineChatStatus.THINKING);

        const strategy = await this.inlineInputService.getInteractiveInputStrategyHandler()(monacoEditor, value);
        const selection = monaco.Selection.fromPositions(position);

        if (strategy === ERunStrategy.EXECUTE && handler.execute) {
          handler.execute(monacoEditor, selection, value, this.token);
          inlineInputWidget.launchChatStatus(EInlineChatStatus.DONE);
          this.hideInput();
          return;
        }

        if (strategy === ERunStrategy.PREVIEW && handler.providePreviewStrategy) {
          const previewResponse = await handler.providePreviewStrategy(monacoEditor, selection, value, this.token);

          if (CancelResponse.is(previewResponse)) {
            inlineInputWidget.launchChatStatus(EInlineChatStatus.READY);
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
                inlineInputWidget.launchChatStatus(EInlineChatStatus.READY);
              }),
              controller.onAbort(() => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                model.pushStackElement();
                inlineInputWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
              controller.onEnd(() => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                model.pushStackElement();
                inlineInputWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
            ]);

            controller.listen();
          }
        }
      }),
    );

    this.inputDisposable.addDispose(inlineInputWidget);
  }

  private async showInputInSelection(selection: monaco.Selection, monacoEditor: ICodeEditor, defaultValue?: string) {
    if (this.inputDisposable) {
      this.inputDisposable.dispose();
      this.inputDisposable = new Disposable();
    }

    const model = monacoEditor.getModel();
    if (!model) {
      return;
    }

    const decorationsCollection = monacoEditor.createDecorationsCollection();
    decorationsCollection.set([
      {
        range: monaco.Range.fromPositions(
          { lineNumber: selection.startLineNumber, column: 1 },
          {
            lineNumber: selection.endLineNumber,
            column: monacoEditor.getModel()!.getLineMaxColumn(selection.endLineNumber),
          },
        ),
        options: ModelDecorationOptions.register({
          description: InlineInputPreviewDecorationID,
          isWholeLine: true,
          className: styles.input_decoration_pending_container,
        }),
      },
    ]);
    const decorationSelection = monaco.Selection.fromRange(
      decorationsCollection.getRange(0)!,
      selection.getDirection(),
    );

    this.inputValue.set(defaultValue || '', undefined);
    this.inlineInputWidgetStore.set(model.id, new InlineInputWidgetStoreInSelection(decorationSelection, defaultValue));

    const inlineInputWidget = this.injector.get(InlineInputWidget, [monacoEditor, this.inputValue.get()]);
    inlineInputWidget.show({ selection: decorationSelection });

    this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);

    this.inputDisposable.addDispose(
      inlineInputWidget.onDispose(() => {
        this.cancelToken();
        decorationsCollection.clear();
        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onValueChange((value) => {
        this.inputValue.set(value, undefined);

        const storeData = this.inlineInputWidgetStore.get(model.id);
        if (storeData instanceof InlineInputWidgetStoreInSelection) {
          storeData.setValue(value);
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onClose(() => {
        const isStreaming = this.aiNativeContextKey.inlineInputWidgetIsStreaming.get();
        if (isStreaming) {
          this.cancelToken();
        } else {
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onSend(async (value) => {
        monacoEditor.focus();

        const handler = this.inlineInputService.getInteractiveInputHandler();

        if (!handler) {
          return;
        }

        inlineInputWidget.launchChatStatus(EInlineChatStatus.THINKING);

        const strategy = await this.inlineInputService.getInteractiveInputStrategyHandler()(monacoEditor, value);

        if (strategy === ERunStrategy.PREVIEW && handler.providePreviewStrategy) {
          const previewResponse = await handler.providePreviewStrategy(
            monacoEditor,
            decorationSelection,
            value,
            this.token,
          );

          if (CancelResponse.is(previewResponse)) {
            decorationsCollection.clear();
            this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
            inlineInputWidget.launchChatStatus(EInlineChatStatus.DONE);
            return;
          }

          if (InlineChatController.is(previewResponse)) {
            const chatResponse = previewResponse;

            this.inputDisposable.addDispose([
              chatResponse.onData((data) => {
                decorationsCollection.clear();
                if (ReplyResponse.is(data)) {
                  this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(true);
                }
              }),
              chatResponse.onError((error) => {
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                inlineInputWidget.launchChatStatus(EInlineChatStatus.READY);
              }),
              chatResponse.onAbort(() => {
                decorationsCollection.clear();
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                inlineInputWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
              chatResponse.onEnd(() => {
                decorationsCollection.clear();
                this.aiNativeContextKey.inlineInputWidgetIsStreaming.set(false);
                inlineInputWidget.launchChatStatus(EInlineChatStatus.DONE);
              }),
            ]);

            const diffPreviewer = this.inlineDiffController.showPreviewerByStream(monacoEditor, {
              crossSelection: decorationSelection,
              chatResponse,
            });

            diffPreviewer.mountWidget(inlineInputWidget);

            chatResponse.listen();
          }
        } else {
          decorationsCollection.clear();
          inlineInputWidget.launchChatStatus(EInlineChatStatus.READY);
          this.hideInput();
        }
      }),
    );

    this.inputDisposable.addDispose(
      inlineInputWidget.onResultClick((kind: EResultKind) => {
        this.inlineDiffController.handleAction(kind);
        this.hideInput();

        if (kind === EResultKind.REGENERATE) {
          requestAnimationFrame(() => {
            this.showInputInSelection(decorationSelection, monacoEditor, this.inputValue.get());
          });
        }
      }),
    );

    this.inputDisposable.addDispose(inlineInputWidget);
  }
}
