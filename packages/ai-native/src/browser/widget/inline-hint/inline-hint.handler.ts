import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { KeybindingRegistry, KeybindingScope } from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { InlineHintWidgetIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { Position } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
import { InlineInputPreviewDecorationID } from '../internal.type';

import { InlineHintLineWidget } from './inline-hint-line-widget';

@Injectable()
export class InlineHintHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AICompletionsService)
  private readonly inlineCompletionsService: AICompletionsService;

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  private aiNativeContextKey: AINativeContextKey;

  public registerHintLineFeature(editor: IEditor): IDisposable {
    const { monacoEditor } = editor;
    const hintDisposable = new Disposable();
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [editor.monacoEditor.contextKeyService]);

    let currentVisiblePosition: Position | undefined;

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
        const inlineHintLineWidget = this.injector.get(InlineHintLineWidget, [monacoEditor]);
        inlineHintLineWidget.show({ position });
        currentVisiblePosition = position;

        this.aiNativeContextKey.inlineHintWidgetIsVisible.set(true);

        hintDisposable.addDispose(
          inlineHintLineWidget.onDispose(() => {
            currentVisiblePosition = undefined;
            this.aiNativeContextKey.inlineHintWidgetIsVisible.set(false);
          }),
        );

        hintDisposable.addDispose(inlineHintLineWidget);
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

    this.addDispose(
      this.keybindingRegistry.registerKeybinding(
        {
          command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
          keybinding: 'ctrlcmd+i',
          args: () => currentVisiblePosition,
          priority: 0,
          when: `editorTextFocus && ${InlineHintWidgetIsVisible.raw}`,
        },
        KeybindingScope.USER,
      ),
    );

    return this;
  }
}
