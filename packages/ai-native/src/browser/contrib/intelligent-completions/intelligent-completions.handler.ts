import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  Event,
  IDisposable,
  IntelligentCompletionsRegistryToken,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { CursorChangeReason, ICursorSelectionChangedEvent, Position } from '@opensumi/ide-monaco';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { TextEditorSelectionSource } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';

import { MultiLineDiffComputer } from './diff-computer';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';
import { MultiLineDecorationModel } from './multi-line.decoration';

@Injectable()
export class IntelligentCompletionsHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IntelligentCompletionsRegistryToken)
  private intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private multiLineDiffComputer: MultiLineDiffComputer = new MultiLineDiffComputer();
  private multiLineDecorationModel: MultiLineDecorationModel;

  private editor: IEditor;
  private aiNativeContextKey: AINativeContextKey;

  private async fetch() {
    const provider = this.intelligentCompletionsRegistry.getProvider();
    if (!provider) {
      return;
    }

    const { monacoEditor } = this.editor;

    const position = monacoEditor.getPosition()!;
    const model = monacoEditor.getModel();

    const intelligentCompletionModel = await provider(monacoEditor, position, this.cancelIndicator.token);

    const { items } = intelligentCompletionModel;

    if (items.length === 0) {
      return;
    }

    const { belowRadius, aboveRadius, content } = items[0];

    const originalContent = model?.getValueInRange({
      startLineNumber: position.lineNumber - (aboveRadius || 0),
      startColumn: 1,
      endLineNumber: position.lineNumber + (belowRadius || 0),
      endColumn: model.getLineMaxColumn(position.lineNumber + (belowRadius || 0)),
    });

    const diffComputerResult = this.multiLineDiffComputer.diff(originalContent!, content);

    if (diffComputerResult) {
      const inlineModifications = this.multiLineDecorationModel.applyInlineDecorations(
        monacoEditor,
        diffComputerResult,
        position.lineNumber,
        position,
      );

      if (inlineModifications) {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.set(true);
        this.multiLineDecorationModel.updateLineModificationDecorations(inlineModifications);
      } else {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
        this.multiLineDecorationModel.clearDecorations();
      }
    }
  }

  public hide() {
    this.cancelToken();
    this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
    this.multiLineDecorationModel.clearDecorations();
  }

  public accept() {
    const edits = this.multiLineDecorationModel.getEdits();

    this.editor.monacoEditor.pushUndoStop();
    this.editor.monacoEditor.executeEdits(
      'multiLineCompletions.accept',
      edits.map((edit) =>
        EditOperation.insert(
          Position.lift({ lineNumber: edit.range.startLineNumber, column: edit.range.startColumn }),
          edit.text,
        ),
      ),
    );

    this.hide();
  }

  public registerFeature(editor: IEditor): IDisposable {
    this.editor = editor;
    const { monacoEditor } = editor;

    this.multiLineDecorationModel = new MultiLineDecorationModel(monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);

    /**
     * 触发时机与 inline completion 保持一致
     */
    this.addDispose([
      Event.debounce(
        monacoEditor.onDidType,
        () => {},
        16 * 3,
      )(() => {
        // 取消上一次正在请求中的补全
        this.cancelToken();
        this.fetch();
      }),

      Event.any<any>(
        monacoEditor.onDidChangeModel,
        // monacoEditor.onDidBlurEditorWidget,
      )(() => {
        this.hide();
      }),

      monacoEditor.onDidChangeCursorSelection((event: ICursorSelectionChangedEvent) => {
        if (event.reason === CursorChangeReason.Explicit || event.source === TextEditorSelectionSource.PROGRAMMATIC) {
          this.hide();
        }
      }),
    ]);

    return this;
  }
}
