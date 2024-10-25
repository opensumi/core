import { IDisposable } from '@opensumi/ide-core-common';
import { Disposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { BaseAIMonacoEditorController } from '../../contrib/base';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
import { InlineInputChatService } from '../inline-input/inline-input.service';
import { InlineInputPreviewDecorationID } from '../internal.type';

import { InlineHintLineDecoration } from './inline-hint-line-widget';

export class InlineHintController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.hint';

  public static get(editor: ICodeEditor): InlineHintController | null {
    return editor.getContribution<InlineHintController>(InlineHintController.ID);
  }

  private get inlineCompletionsService(): AICompletionsService {
    return this.injector.get(AICompletionsService);
  }

  private get inlineInputChatService(): InlineInputChatService {
    return this.injector.get(InlineInputChatService);
  }

  mount(): IDisposable {
    return this.registerHintLineFeature(this.monacoEditor);
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

    this.featureDisposable.addDispose(
      monacoEditor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
        hideHint();
        showHint(e.position);
      }),
    );

    this.featureDisposable.addDispose(
      monacoEditor.onDidFocusEditorWidget(() => {
        const currentPosition = monacoEditor.getPosition();

        if (currentPosition) {
          hideHint();
          showHint(currentPosition);
        }
      }),
    );

    this.featureDisposable.addDispose(
      monacoEditor.onDidBlurEditorWidget(() => {
        hideHint();
      }),
    );

    this.featureDisposable.addDispose(
      this.inlineCompletionsService.onVisibleCompletion((v) => {
        if (v) {
          hideHint();
        }
      }),
    );

    this.featureDisposable.addDispose(hintDisposable);

    return this.featureDisposable;
  }
}
