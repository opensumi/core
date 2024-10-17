import cls from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Injectable } from '@opensumi/di';
import { Deferred, Event, MonacoService, isUndefined, runWhenIdle, useInjectable } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import {
  ReactInlineContentWidget,
  ShowAIContentOptions,
} from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { IEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { space } from '@opensumi/ide-utils/lib/strings';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { IMultiLineDiffChangeResult } from '../../contrib/intelligent-completions/diff-computer';

import styles from './rewrite-widget.module.less';

const editorOptions: IEditorOptions = {
  fixedOverflowWidgets: true,
  readOnly: true,
  domReadOnly: true,
  lineNumbers: 'off',
  glyphMargin: false,

  scrollBeyondLastLine: false,
  rulers: undefined,
  overviewRulerBorder: undefined,
  overviewRulerLanes: 0,
  padding: { top: 0, bottom: 0 },
  folding: false,
  stickyScroll: { enabled: false },
  minimap: { enabled: false },
  automaticLayout: true,

  scrollbar: {
    horizontal: 'hidden',
    vertical: 'hidden',
    horizontalScrollbarSize: 0,
    verticalScrollbarSize: 0,
    arrowSize: 0,
    verticalSliderSize: 0,
    horizontalSliderSize: 0,
    ignoreHorizontalScrollbarInContentHeight: true,
  },
  hover: {
    enabled: false,
  },
  guides: {
    indentation: false,
  },
};

interface ITextBoxHandler {
  getVirtualEditor: () => ICodeEditor | null;
  layout: (range: monaco.IRange) => void;
  renderVirtualEditor: (newValue: string, range: monaco.IRange, wordChanges: IMultiLineDiffChangeResult[]) => void;
  renderTextLineThrough: (lineChanges: { changes: IMultiLineDiffChangeResult[][] }[]) => void;
}

interface ITextBoxProviderProps {
  editor: ICodeEditor;
  onReady?: (handler: ITextBoxHandler) => void;
}

export const REWRITE_DECORATION_INLINE_ADD = 'rewrite-decoration-inline-add';

const TextBoxProvider = React.memo((props: ITextBoxProviderProps) => {
  const { editor, onReady } = props;
  const monacoService: MonacoService = useInjectable(MonacoService);
  const ref = useRef<HTMLDivElement>(null);
  const refRoot = useRef<ReactDOMClient.Root | null>(null);

  const [editorSize, setEditorSize] = useState<{ width: number; height: number } | null>(null);
  const [marginLeft, setMarginLeft] = useState(0);
  const [virtualEditor, setVirtualEditor] = useState<ICodeEditor | null>(null);

  const changeDecorations = useCallback(
    (virtualEditor: ICodeEditor, range: monaco.IRange, wordChanges: IMultiLineDiffChangeResult[]): void => {
      const eol = editor.getModel()!.getEOL();

      let currentLineNumber = range.startLineNumber;
      let currentColumn = range.startColumn;

      const virtualModel = virtualEditor.getModel()!;

      virtualEditor.changeDecorations((accessor) => {
        if (virtualEditor) {
          virtualModel
            .getAllDecorations()
            .map((decoration) => decoration.id)
            .forEach((decorationId) => accessor.removeDecoration(decorationId));

          for (const change of wordChanges) {
            if (change.removed) {
              continue;
            }
            const lines = change.value.split(eol);
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
              const line = lines[lineIndex];
              if (lineIndex !== 0) {
                currentLineNumber++;
                currentColumn = 1;
              }
              if (change.added) {
                accessor.addDecoration(
                  new monaco.Range(currentLineNumber, currentColumn, currentLineNumber, currentColumn + line.length),
                  {
                    description: REWRITE_DECORATION_INLINE_ADD,
                    className: styles.ghost_text_decoration_inline_add,
                  },
                );
              }
              currentColumn += line.length;
            }
          }
        }
      });

      const lineHeight = virtualEditor!.getOption(monaco.editor.EditorOption.lineHeight);
      virtualEditor?.setScrollTop(Math.max(range.startLineNumber - 1, 0) * lineHeight);

      const lineCount = currentLineNumber - range.startLineNumber;
      const spaceWidth = virtualEditor!.getOption(monaco.editor.EditorOption.fontInfo).spaceWidth;
      const contentLeft = virtualEditor!.getOption(monaco.editor.EditorOption.layoutInfo).contentLeft;
      let maxColumnWidth = 0;
      const tabSize = virtualModel.getOptions().tabSize;
      Array.from(
        {
          length: lineCount + 1,
        },
        (_, index) => range.startLineNumber + index,
      ).forEach((lineNumber) => {
        const lineContent = virtualModel.getLineContent(lineNumber);
        let columnWidth = 0;
        for (const char of lineContent) {
          if (char === space) {
            columnWidth += tabSize;
          } else {
            columnWidth += 1;
          }
          maxColumnWidth = Math.max(maxColumnWidth, columnWidth);
        }
      });

      setEditorSize({ width: maxColumnWidth * spaceWidth + contentLeft * 2, height: lineHeight * (lineCount + 1) });
    },
    [editorSize, editor],
  );

  useEffect(() => {
    const model: ITextModel | null = editor.getModel();

    if (!model) {
      return;
    }

    if (onReady) {
      onReady({
        getVirtualEditor: () => virtualEditor,
        renderVirtualEditor: (newValue, range, wordChanges) => renderVirtualEditor(newValue, range, wordChanges),
        renderTextLineThrough: (lineChanges) => renderTextLineThrough(lineChanges),
        layout: (range) => layout(range),
      });
    }

    return () => {
      if (virtualEditor) {
        virtualEditor.dispose();
      }
      if (refRoot.current) {
        runWhenIdle(() => {
          refRoot.current?.unmount();
          refRoot.current = null;
        });
      }
    };
  }, [editor, onReady, virtualEditor]);

  const renderVirtualEditor = useCallback(
    (newValue: string, range: monaco.IRange, wordChanges: IMultiLineDiffChangeResult[]) => {
      if (!ref.current) {
        return;
      }

      const model: ITextModel | null = editor.getModel();

      if (!model) {
        return;
      }

      let _virtualEditor = virtualEditor;

      if (!_virtualEditor) {
        _virtualEditor = monacoService.createCodeEditor(ref.current!, editorOptions);
        const modelService = StandaloneServices.get(IModelService);
        const languageSelection: ILanguageSelection = { languageId: model.getLanguageId(), onDidChange: Event.None };

        const virtualModel = modelService.createModel('', languageSelection);
        _virtualEditor.setModel(virtualModel);

        setVirtualEditor(_virtualEditor);
      }

      _virtualEditor.setValue(newValue);

      changeDecorations(_virtualEditor, range, wordChanges);
    },
    [ref, virtualEditor],
  );

  const renderTextLineThrough = useCallback(
    (lineChanges: { changes: IMultiLineDiffChangeResult[][] }[]) => {
      if (!ref.current) {
        return;
      }

      if (virtualEditor) {
        virtualEditor.dispose();
        setVirtualEditor(null);
      }

      const LineElement = ({ changes }: { changes: IMultiLineDiffChangeResult[][] }) => {
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        const spaceWidth = editor.getOption(monaco.editor.EditorOption.fontInfo).spaceWidth;

        const createSpaceSpan = (spaceCount: number, className: string = styles.ghost_text_decoration) => (
          <span className={cls(styles.space_span, className)} style={{ width: `${spaceWidth * spaceCount}px` }}>
            {space.repeat(spaceCount)}
          </span>
        );

        const createTextSpan = (textContent: string, className: string) => (
          <span className={cls(styles.text_span, className)}>{textContent}</span>
        );

        return (
          <React.Fragment>
            {changes.map((change, index) => {
              let isOnlySpaces = true;
              let removedText = '';
              let textLength = 0;
              const lineElements: React.JSX.Element[] = [];

              for (const item of change) {
                const { value, added, removed } = item;
                if (removed) {
                  removedText += value;
                } else {
                  isOnlySpaces = false;
                  textLength += value.length;
                  const leadingSpaces = value.length - value.trimStart().length;
                  const trailingSpaces = value.length - value.trimEnd().length;
                  const trimmedValue = value.trim();

                  lineElements.push(createSpaceSpan(leadingSpaces));
                  if (trimmedValue) {
                    lineElements.push(
                      createTextSpan(
                        trimmedValue,
                        added ? styles.ghost_text_decoration_inline_add : styles.ghost_text_decoration,
                      ),
                    );
                    lineElements.push(createSpaceSpan(trailingSpaces));
                  }
                }
              }

              if (isOnlySpaces) {
                const leadingSpaces = removedText.length - removedText.trimStart().length;
                const trailingSpaces = removedText.length - removedText.trimEnd().length;
                const trimmedRemovedText = removedText.trim();
                lineElements.push(createSpaceSpan(leadingSpaces, styles.ghost_text_decoration_remove));
                if (trimmedRemovedText) {
                  lineElements.push(createTextSpan(trimmedRemovedText, styles.ghost_text_decoration_inline_remove));
                  lineElements.push(createSpaceSpan(trailingSpaces, styles.ghost_text_decoration_inline_remove));
                }
              }

              return (
                <div key={index} className={styles.deletions_code_line} style={{ height: `${lineHeight}px` }}>
                  {lineElements}
                </div>
              );
            })}
          </React.Fragment>
        );
      };

      if (refRoot.current) {
        refRoot.current.unmount();
        refRoot.current = null;
      }

      refRoot.current = ReactDOMClient.createRoot(ref.current);
      refRoot.current.render(
        <React.Fragment>
          {lineChanges.map((lineChange, index) => (
            <LineElement key={index} changes={lineChange.changes} />
          ))}
        </React.Fragment>,
      );
    },
    [editor, ref, virtualEditor, refRoot],
  );

  const layout = useCallback(
    (range: monaco.IRange) => {
      const spaceWidth = editor!.getOption(monaco.editor.EditorOption.fontInfo).spaceWidth;

      let maxLineColumn = 0;
      for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
        const lineMaxColumn = editor!.getModel()!.getLineMaxColumn(lineNumber);
        maxLineColumn = Math.max(maxLineColumn, lineMaxColumn);
      }

      setMarginLeft(maxLineColumn * spaceWidth + 10);
    },
    [editor],
  );

  return (
    <div
      className={styles.rewrite_widget_container}
      style={{ width: editorSize?.width, height: editorSize?.height, marginLeft }}
    >
      <div className={styles.virtual_editor_container} ref={ref}></div>
    </div>
  );
});

@Injectable({ multiple: true })
export class RewriteWidget extends ReactInlineContentWidget {
  private virtualEditorHandler: ITextBoxHandler | null = null;

  positionPreference: ContentWidgetPositionPreference[] = [ContentWidgetPositionPreference.EXACT];
  defered = new Deferred();

  private editArea: monaco.IRange;
  private insertText: string;
  private updateFontStyle = () => {
    const fontInfo = this.editor.getOption(monaco.editor.EditorOption.fontInfo);
    this.domNode.style.fontFamily = fontInfo.fontFamily;
    this.domNode.style.fontSize = fontInfo.fontSize + 'px';
  };

  public renderView(): React.ReactNode {
    this.updateFontStyle();

    return (
      <TextBoxProvider
        editor={this.editor}
        onReady={(handler) => {
          this.defered.resolve();
          this.virtualEditorHandler = handler;
        }}
      />
    );
  }
  public id(): string {
    return 'RewriteWidget';
  }

  override show(options: ShowAIContentOptions): void {
    const { position } = options;

    if (!position) {
      return;
    }

    const { lineNumber } = position;

    super.show({ position: monaco.Position.lift({ lineNumber, column: 1 }) });
  }

  public setInsertText(insertText: string) {
    this.insertText = insertText;
  }

  public setEditArea(range: monaco.IRange) {
    this.editArea = range;
  }

  public getEditArea(): monaco.IRange {
    return this.editArea;
  }

  public getVirtualEditor(): ICodeEditor | null {
    return this.virtualEditorHandler?.getVirtualEditor() ?? null;
  }

  public renderTextLineThrough(lineChanges: { changes: IMultiLineDiffChangeResult[][] }[]): void {
    this.virtualEditorHandler?.renderTextLineThrough(lineChanges);
    this.virtualEditorHandler?.layout(this.editArea);
  }

  public renderVirtualEditor(newValue: string, wordChanges: IMultiLineDiffChangeResult[]): void {
    this.virtualEditorHandler!.renderVirtualEditor(newValue, this.editArea, wordChanges);
    this.virtualEditorHandler!.layout(this.editArea);
  }

  public accept() {
    if (isUndefined(this.insertText)) {
      return;
    }

    this.editor.pushUndoStop();
    this.editor
      .getModel()!
      .pushEditOperations(null, [EditOperation.replace(monaco.Range.lift(this.editArea), this.insertText)], () => null);
  }
}
