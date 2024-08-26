import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Injectable } from '@opensumi/di';
import { Event, MonacoService, useInjectable } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import {
  ReactInlineContentWidget,
  ShowAIContentOptions,
} from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { IEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { space } from '@opensumi/ide-utils/lib/strings';
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

interface IVirtualEditorHandler {
  getVirtualEditor: () => ICodeEditor;
  changeDecorations: (range: monaco.IRange, wordChanges: IMultiLineDiffChangeResult[]) => void;
}

interface IVirtualEditorProviderProps {
  editor: ICodeEditor;
  onReady?: (handler: IVirtualEditorHandler) => void;
}

const VirtualEditorProvider = React.memo((props: IVirtualEditorProviderProps) => {
  const { editor, onReady } = props;
  const monacoService: MonacoService = useInjectable(MonacoService);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 300, height: 60 });
  const [marginLeft, setMarginLeft] = useState(0);

  const changeDecorations = useCallback(
    (virtualEditor: ICodeEditor, range: monaco.IRange, wordChanges: IMultiLineDiffChangeResult[]): void => {
      const eol = editor.getModel()!.getEOL();

      let currentLineNumber = range.startLineNumber;
      let currentColumn = range.startColumn;

      const virtualModel = virtualEditor.getModel()!;

      virtualEditor.changeDecorations((decorations) => {
        if (virtualEditor) {
          virtualModel
            .getAllDecorations()
            .map((decoration) => decoration.id)
            .forEach((decorationId) => decorations.removeDecoration(decorationId));

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
                decorations.addDecoration(
                  new monaco.Range(currentLineNumber, currentColumn, currentLineNumber, currentColumn + line.length),
                  {
                    description: 'ghost-text-decoration',
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
          char === space ? (columnWidth += tabSize) : (columnWidth += 1);
          maxColumnWidth = Math.max(maxColumnWidth, columnWidth);
        }
      });

      setEditorSize({ width: maxColumnWidth * spaceWidth, height: lineHeight * lineCount });

      let maxLineColumn = 0;
      for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
        const lineMaxColumn = virtualModel.getLineMaxColumn(lineNumber);
        maxLineColumn = Math.max(maxLineColumn, lineMaxColumn);
      }
      setMarginLeft(maxLineColumn * spaceWidth + 10);
    },
    [editorSize, editor],
  );

  useEffect(() => {
    const model: ITextModel | null = editor.getModel();

    if (!model) {
      return;
    }

    const virtualEditor = monacoService.createCodeEditor(editorRef.current!, editorOptions);

    const modelService = StandaloneServices.get(IModelService);
    const languageSelection: ILanguageSelection = { languageId: model.getLanguageId(), onDidChange: Event.None };

    const virtualModel = modelService.createModel('', languageSelection);

    virtualEditor.setModel(virtualModel);

    if (onReady) {
      onReady({
        getVirtualEditor: () => virtualEditor,
        changeDecorations: (range, wordChanges) => changeDecorations(virtualEditor, range, wordChanges),
      });
    }

    return () => {
      if (virtualEditor) {
        virtualEditor.dispose();
      }
    };
  }, [editor, onReady]);

  return (
    <div
      className={styles.rewrite_widget_container}
      style={{ width: editorSize.width, height: editorSize.height, marginLeft }}
    >
      <div className={styles.virtual_editor_container} ref={editorRef}></div>;
    </div>
  );
});

@Injectable({ multiple: true })
export class RewriteWidget extends ReactInlineContentWidget {
  private virtualEditorHandler: IVirtualEditorHandler | null = null;

  positionPreference: ContentWidgetPositionPreference[] = [ContentWidgetPositionPreference.EXACT];

  public renderView(): React.ReactNode {
    return (
      <VirtualEditorProvider
        editor={this.editor}
        onReady={(handler) => {
          this.virtualEditorHandler = handler;
        }}
      />
    );
  }
  public id(): string {
    return 'RewriteWidget';
  }

  public getVirtualEditor(): ICodeEditor {
    return this.virtualEditorHandler!.getVirtualEditor();
  }

  override show(options: ShowAIContentOptions): void {
    const { position } = options;

    if (!position) {
      return;
    }

    const { lineNumber } = position;

    super.show({ position: monaco.Position.lift({ lineNumber, column: 1 }) });
  }

  public changeDecorations(range: monaco.IRange, wordChanges: IMultiLineDiffChangeResult[]): void {
    this.virtualEditorHandler!.changeDecorations(range, wordChanges);
  }
}
