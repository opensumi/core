import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancelResponse,
  CancellationTokenSource,
  Disposable,
  Event,
  FRAME_THREE,
  IDisposable,
  InlineChatFeatureRegistryToken,
  ReplyResponse,
  RunOnceScheduler,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { ERunStrategy } from '../../types';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { InlineChatFeatureRegistry } from '../inline-chat/inline-chat.feature.registry';
import { EInlineChatStatus, EResultKind } from '../inline-chat/inline-chat.service';
import { InlineInputPreviewDecorationID } from '../internal.type';

import { InlineInputChatWidget } from './inline-input-widget';
import styles from './inline-input.module.less';
import { InlineInputChatService } from './inline-input.service';

@Injectable()
export class InlineInputHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(InlineInputChatService)
  private readonly inlineInputChatService: InlineInputChatService;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  private aiNativeContextKey: AINativeContextKey;

  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
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
      handler.execute(monacoEditor, value, this.cancelIndicator.token);
      widget.launchChatStatus(EInlineChatStatus.DONE);
      hideInput();
      return;
    }

    if (strategy === ERunStrategy.PREVIEW && handler.providerPreviewStrategy) {
      const previewResponse = await handler.providerPreviewStrategy(monacoEditor, value, this.cancelIndicator.token);

      if (CancelResponse.is(previewResponse)) {
        widget.launchChatStatus(EInlineChatStatus.READY);
        hideInput();
        return;
      }

      if (InlineChatController.is(previewResponse)) {
        const controller = previewResponse as InlineChatController;

        controller.listen();

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
      }
    }
  }

  public registerInlineInputFeature(editor: IEditor): IDisposable {
    const { monacoEditor } = editor;
    const inputDisposable = new Disposable();
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [editor.monacoEditor.contextKeyService]);

    const hideInput = () => {
      inputDisposable.dispose();
    };

    this.addDispose(
      this.inlineInputChatService.onInteractiveInputVisibleInPosition((position) => {
        hideInput();

        if (position) {
          showInput(position);
        }
      }),
    );

    const showInput = (position: monaco.Position) => {
      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor]);

      const collection = monacoEditor.createDecorationsCollection();

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

      const decorationRange = collection.getRange(0)!;
      let preLineRange: LineRange = LineRange.fromRange(decorationRange);

      inlineInputChatWidget.show({ position: decorationRange.getStartPosition() });

      this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);

      inputDisposable.addDispose(
        inlineInputChatWidget.onDispose(() => {
          this.cancelToken();
          collection.clear();
          this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
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

    this.addDispose(inputDisposable);

    this.addDispose(
      monacoEditor.onWillChangeModel(() => {
        hideInput();
      }),
    );

    return this;
  }
}
