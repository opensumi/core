import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancelResponse,
  CancellationTokenSource,
  Disposable,
  Event,
  IDisposable,
  InlineChatFeatureRegistryToken,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { SelectionDirection } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
import { ERunStrategy } from '../../types';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { InlineChatFeatureRegistry } from '../inline-chat/inline-chat.feature.registry';
import { EInlineChatStatus } from '../inline-chat/inline-chat.service';

import { InlineInputChatWidget } from './inline-input-widget';
import styles from './inline-input.module.less';
import { InlineInputChatService } from './inline-input.service';


@Injectable()
export class InlineInputHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AICompletionsService)
  private readonly inlineCompletionsService: AICompletionsService;

  @Autowired(InlineInputChatService)
  private readonly inlineInputChatService: InlineInputChatService;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  private aiNativeContextKey: AINativeContextKey;
  private cancelIndicator = new CancellationTokenSource();
  private previewReadableDisposable = new Disposable();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
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

      if (this.inlineCompletionsService.isVisibleCompletion) {
        return;
      }

      const content = model.getLineContent(position.lineNumber);
      const isEmpty = content?.trim() === empty;
      const isEmptySelection = monacoEditor.getSelection()?.isEmpty();

      if (isEmpty && isEmptySelection) {
        const inlineInputChatWidget = this.injector.get(InlineInputChatWidget, [monacoEditor]);

        const collection = monacoEditor.createDecorationsCollection();
        collection.append([
          {
            range: monaco.Range.fromPositions(position),
            options: {
              description: '',
              isWholeLine: true,
              className: styles.input_decoration_readable_container,
              inlineClassName: styles.inline_chat_inserted_range,
            },
          },
        ]);

        const decorationRange = collection.getRange(0)!;
        let preLineRange: LineRange = LineRange.fromRange(decorationRange);

        inlineInputChatWidget.show({ selection: monaco.Selection.fromRange(decorationRange, SelectionDirection.LTR) });

        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);

        inputDisposable.addDispose(
          inlineInputChatWidget.onDispose(() => {
            this.cancelToken();
            collection.clear();
            this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
          }),
        );

        inputDisposable.addDispose(
          Event.debounce(
            collection.onDidChange.bind(collection),
            () => {},
            16 * 3,
          )(() => {
            const curLineRange = LineRange.fromRange(collection.getRange(0)!);
            if (!preLineRange.equals(curLineRange)) {
              inlineInputChatWidget.setOptions({
                selection: monaco.Selection.fromRange(collection.getRange(0)!, SelectionDirection.LTR),
              });

              inlineInputChatWidget.layoutContentWidget();
            }
            preLineRange = curLineRange;
          }),
        );

        inputDisposable.addDispose(
          inlineInputChatWidget.onInteractiveInputValue(async (value) => {
            const handler = this.inlineChatFeatureRegistry.getInteractiveInputHandler();

            if (!handler) {
              return;
            }

            inlineInputChatWidget.launchChatStatus(EInlineChatStatus.THINKING);

            const strategy = await this.inlineChatFeatureRegistry.getInteractiveInputStrategyHandler()(
              monacoEditor,
              value,
            );

            if (strategy === ERunStrategy.EXECUTE && handler.execute) {
              handler.execute(monacoEditor, value, this.cancelIndicator.token);
              inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
              hideInput();
              return;
            }

            if (strategy === ERunStrategy.PREVIEW && handler.providerPreviewStrategy) {
              const previewResponse = await handler.providerPreviewStrategy(
                monacoEditor,
                value,
                this.cancelIndicator.token,
              );

              if (CancelResponse.is(previewResponse)) {
                inlineInputChatWidget.launchChatStatus(EInlineChatStatus.READY);
                hideInput();
                return;
              }

              if (InlineChatController.is(previewResponse)) {
                const controller = previewResponse as InlineChatController;

                controller.deffered.resolve();

                this.previewReadableDisposable.addDispose([
                  controller.onData(async (data) => {
                    if (!ReplyResponse.is(data)) {
                      return;
                    }

                    const { message } = data;

                    const curPosi = collection.getRange(0)!;
                    model.pushEditOperations(
                      null,
                      [
                        {
                          range: monaco.Range.fromPositions(curPosi.getEndPosition()),
                          text: message,
                        },
                      ],
                      () => null,
                    );
                  }),
                  controller.onError((error) => {
                    inlineInputChatWidget.launchChatStatus(EInlineChatStatus.ERROR);
                  }),
                  controller.onAbort(() => {
                    inlineInputChatWidget.launchChatStatus(EInlineChatStatus.READY);
                  }),
                  controller.onEnd(() => {
                    inlineInputChatWidget.launchChatStatus(EInlineChatStatus.DONE);
                  }),
                ]);
              }
            }
          }),
        );

        inputDisposable.addDispose(inlineInputChatWidget);
      }
    };

    this.disposables.push(inputDisposable);

    return this;
  }
}
