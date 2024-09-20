import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { BaseAIMonacoContribHandler } from '../../contrib/base';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
import { InlineInputChatService } from '../inline-input/inline-input.service';
import { InlineInputPreviewDecorationID } from '../internal.type';

import { InlineHintLineDecoration } from './inline-hint-line-widget';

@Injectable({ multiple: true })
export class InlineHintHandler extends BaseAIMonacoContribHandler {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AICompletionsService)
  private readonly inlineCompletionsService: AICompletionsService;

  @Autowired(InlineInputChatService)
  private readonly inlineInputChatService: InlineInputChatService;

  doContribute(): IDisposable {
    if (this.monacoEditor) {
      return this.registerHintLineFeature(this.monacoEditor);
    }
    return this;
  }

  private registerHintLineFeature(monacoEditor: monaco.ICodeEditor): IDisposable {
    const hintDisposable = new Disposable();
    const aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);

    const hideHint = () => {
      hintDisposable.dispose();
    };

    const showHint = (position: monaco.Position) => {
      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      if (this.inlineCompletionsService.isVisibleCompletion) {
        return;
      }

      const content = model.getLineContent(position.lineNumber);
      const decorations = model.getLineDecorations(position.lineNumber);

      const isEmpty = content?.trim() === empty;
      const isEmptySelection = monacoEditor.getSelection()?.isEmpty();
      const hasPreviewDecoration = decorations.some(
        (dec) => dec.options.description === InlineInputPreviewDecorationID,
      );

      if (isEmpty && isEmptySelection && !hasPreviewDecoration) {
        const inlineHintLineDecoration = this.injector.get(InlineHintLineDecoration, [monacoEditor]);
        inlineHintLineDecoration.show(position);
        this.inlineInputChatService.setCurrentVisiblePosition(position);

        aiNativeContextKey.inlineHintWidgetIsVisible.set(true);

        hintDisposable.addDispose(
          inlineHintLineDecoration.onDispose(() => {
            this.inlineInputChatService.setCurrentVisiblePosition(undefined);
            aiNativeContextKey.inlineHintWidgetIsVisible.set(false);
          }),
        );

        hintDisposable.addDispose(inlineHintLineDecoration);
      }
    };

    this.addDispose(
      monacoEditor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
        hideHint();
        showHint(e.position);
      }),
    );

    this.addDispose(
      monacoEditor.onDidFocusEditorWidget(() => {
        const currentPosition = monacoEditor.getPosition();

        if (currentPosition) {
          hideHint();
          showHint(currentPosition);
        }
      }),
    );

    this.addDispose(
      monacoEditor.onDidBlurEditorWidget(() => {
        hideHint();
      }),
    );

    this.addDispose(
      this.inlineCompletionsService.onVisibleCompletion((v) => {
        if (v) {
          hideHint();
        }
      }),
    );

    this.addDispose(hintDisposable);

    return this;
  }
}
