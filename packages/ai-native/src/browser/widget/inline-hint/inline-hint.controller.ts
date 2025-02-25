import throttle from 'lodash/throttle';

import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { BaseAIMonacoEditorController } from '../../contrib/base';
import { AICompletionsService } from '../../contrib/inline-completions/service/ai-completions.service';
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

      if (position.lineNumber > model.getLineCount()) {
        return;
      }

      if (this.inlineCompletionsService.isVisibleCompletion) {
        return;
      }

      const decorations = model.getLineDecorations(position.lineNumber);
      const hasPreviewDecoration = decorations.some(
        (dec) => dec.options.description === InlineInputPreviewDecorationID,
      );
      if (!hasPreviewDecoration) {
        const inlineHintLineDecoration = this.injector.get(InlineHintLineDecoration, [monacoEditor]);
        const lineContent = model.getLineContent(position.lineNumber);
        if (!lineContent?.trim()) {
          inlineHintLineDecoration.show(position);
        }

        aiNativeContextKey.inlineHintWidgetIsVisible.set(true);

        hintDisposable.addDispose(
          inlineHintLineDecoration.onDispose(() => {
            // 这里的装饰器逻辑可能会被代码补全顶替
            // 为了保证能正常触发快捷键，移除更新位置逻辑
            aiNativeContextKey.inlineHintWidgetIsVisible.set(false);
          }),
        );

        hintDisposable.addDispose(inlineHintLineDecoration);
      }
    };

    const handleHintChange = throttle(async (position: monaco.Position) => {
      hideHint();
      showHint(position);
    }, 100);

    this.featureDisposable.addDispose(
      monacoEditor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
        handleHintChange(e.position);
      }),
    );

    this.featureDisposable.addDispose(
      monacoEditor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent) => {
        handleHintChange(new monaco.Position(e.changes[0]?.range.endLineNumber, e.changes[0]?.range.endColumn));
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
