import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancelResponse,
  CancellationTokenSource,
  Disposable,
  IDisposable,
  InlineChatFeatureRegistryToken,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
import { ERunStrategy } from '../../types';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { InlineChatFeatureRegistry } from '../inline-chat/inline-chat.feature.registry';

import { InlineInputChatWidget } from './inline-input-widget';
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
        if (!position) {
          hideInput();
          return;
        }

        showInput(position);
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
        const inlineHintLineWidget = this.injector.get(InlineInputChatWidget, [monacoEditor]);
        inlineHintLineWidget.show({
          selection: new monaco.Selection(position.lineNumber, position.column, position.lineNumber, position.column),
        });
        this.aiNativeContextKey.inlineInputWidgetIsVisible.set(true);

        inputDisposable.addDispose(
          inlineHintLineWidget.onDispose(() => {
            this.cancelToken();
            this.aiNativeContextKey.inlineInputWidgetIsVisible.set(false);
          }),
        );

        inputDisposable.addDispose(
          inlineHintLineWidget.onInteractiveInputValue(async (value) => {
            const handler = this.inlineChatFeatureRegistry.getInteractiveInputHandler();

            if (!handler) {
              return;
            }

            const strategy = await this.inlineChatFeatureRegistry.getInteractiveInputStrategyHandler()(
              monacoEditor,
              value,
            );

            if (strategy === ERunStrategy.EXECUTE && handler.execute) {
              handler.execute(monacoEditor, value, this.cancelIndicator.token);
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
                hideInput();
                return;
              }

              if (InlineChatController.is(previewResponse)) {
                const controller = previewResponse as InlineChatController;

                controller.deffered.resolve();
                let curPosi = position;

                this.previewReadableDisposable.addDispose([
                  controller.onData(async (data) => {
                    if (!ReplyResponse.is(data)) {
                      return;
                    }

                    const { message } = data;

                    const newPosition = model.modifyPosition(curPosi, 0);
                    const edit = EditOperation.insert(newPosition, message);
                    model.pushEditOperations(null, [edit], () => null);

                    curPosi = model.getPositionAt(model.getOffsetAt(newPosition) + message.length);
                  }),
                ]);
              }
            }
          }),
        );

        inputDisposable.addDispose(inlineHintLineWidget);
      }
    };

    this.disposables.push(inputDisposable);

    return this;
  }
}
