import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { IDisposable } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';

import { InlineHintLineWidget } from './inline-hint-line-widget';

@Injectable()
export class InlineHintHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AICompletionsService)
  private inlineCompletionsService: AICompletionsService;

  private aiNativeContextKey: AINativeContextKey;

  public registerHintLineFeature(editor: IEditor): IDisposable {
    const { monacoEditor } = editor;
    const hintDisposable = new Disposable();
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [editor.monacoEditor.contextKeyService]);

    const showHint = (position: monaco.Position) => {
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
        const inlineHintLineWidget = this.injector.get(InlineHintLineWidget, [monacoEditor]);
        inlineHintLineWidget.show({ position });
        this.aiNativeContextKey.inlineHintWidgetIsVisible.set(true);

        hintDisposable.addDispose(
          inlineHintLineWidget.onDispose(() => {
            this.aiNativeContextKey.inlineHintWidgetIsVisible.set(false);
          }),
        );

        hintDisposable.addDispose(inlineHintLineWidget);
      }
    };

    this.disposables.push(
      monacoEditor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
        hintDisposable.dispose();
        showHint(e.position);
      }),
    );

    this.disposables.push(
      monacoEditor.onDidFocusEditorWidget(() => {
        const currentPosition = monacoEditor.getPosition();

        if (currentPosition) {
          hintDisposable.dispose();
          showHint(currentPosition);
        }
      }),
    );

    this.disposables.push(
      monacoEditor.onDidBlurEditorWidget(() => {
        hintDisposable.dispose();
      }),
    );

    this.disposables.push(
      this.inlineCompletionsService.onVisibleCompletion((v) => {
        if (v) {
          hintDisposable.dispose();
        }
      }),
    );

    this.disposables.push(hintDisposable);

    return this;
  }
}
