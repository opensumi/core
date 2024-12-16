import { EditorProvider, MonacoEnvironment } from '@alipay/e2-editor-core';
import { memo, useCallback, useEffect, useRef } from 'react';
import type { DiffEditorProps } from '../libro-diff-protocol';
import { getLibroCellType, getSource } from '../libro-diff-protocol';
import { useSize } from './hooks';
import './index.less';

const getEditorLanguage = (libroCellType: string) => {
  if (libroCellType === 'sql') {
    return 'sql-odps';
  } else if (libroCellType === 'markdown' || libroCellType === 'raw') {
    return 'markdown';
  } else {
    return 'python';
  }
};

export const LibroDiffUnchangedCellComponent: React.FC<DiffEditorProps> = memo(
  ({ diffCellResultItem }) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const language = diffCellResultItem.origin.metadata.libroCellType
      ? getEditorLanguage(diffCellResultItem.origin.metadata.libroCellType.toString())
      : getEditorLanguage(diffCellResultItem.origin.cell_type);

    const editorDiffRef = useRef<HTMLDivElement>(null);
    const diffInnerEditorRef = useRef<monaco.editor.IStandaloneDiffEditor>();
    const diffEditorInstance = diffInnerEditorRef;

    const setDiffEditorHeight = useCallback(() => {
      const originalLineCount =
        diffEditorInstance.current?.getModel()?.original.getLineCount() || 0;

      diffEditorInstance.current?.onDidUpdateDiff(() => {
        let finalLineCount = originalLineCount;

        for (const change of diffEditorInstance.current?.getLineChanges() || []) {
          if (!change.originalEndLineNumber)
            finalLineCount += change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
        }

        if (!editorDiffRef.current || !editorContainerRef.current) return;

        editorDiffRef.current.style.height = `${finalLineCount * 20 + 12}px`;
        editorContainerRef.current.style.height = `${finalLineCount * 20 + 12 + 16 + 22}px`;
        diffEditorInstance.current?.layout();
      });
    }, [diffEditorInstance]);

    const editorLaylout = () => {
      if (diffEditorInstance.current) {
        diffEditorInstance.current.layout();
      }
    };

    useEffect(() => {
      window.addEventListener('resize', editorLaylout);
      return () => {
        window.removeEventListener('resize', editorLaylout);
      };
    }, [diffEditorInstance]);

    useSize(editorLaylout, editorContainerRef);

    MonacoEnvironment.init().then(async () => {
      const editorPorvider = MonacoEnvironment.container.get<EditorProvider>(EditorProvider);
      if (!editorDiffRef.current) return;
      diffEditorInstance.current = editorPorvider.createDiff(editorDiffRef.current, {
        language: language,
        minimap: {
          enabled: false,
        },
        automaticLayout: false,
        modified: getSource(diffCellResultItem.target),
        original: getSource(diffCellResultItem.origin),
        renderSideBySide: true,
        fontSize: 13,
        folding: true,
        wordWrap: 'off',
        renderIndicators: false,
        lineNumbersMinChars: 3,
        scrollbar: {
          vertical: 'hidden',
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 0,
          horizontal: 'visible',
          horizontalScrollbarSize: 0,
        },
        glyphMargin: true,
        scrollBeyondLastLine: false,
        scrollBeyondLastColumn: 1,
        renderFinalNewline: false,
        renderOverviewRuler: false,
        renderLineHighlight: 'none',
        enableSplitViewResizing: false,
        lineDecorationsWidth: '16px',
        diffWordWrap: 'off',
        readOnly: true,
        extraEditorClassName: `libro-diff-editor-${diffCellResultItem.diffType}`,
      }).codeEditor;
      setDiffEditorHeight();
    });

    return (
      <div className="libro-diff-cell-container" ref={editorContainerRef}>
        <div className="libro-diff-cell-unchanged-container">
          <div className={`libro-diff-cell-unchanged-origin-header ${diffCellResultItem.diffType}`}>
            <span className="libro-diff-cell-header-text">
              {getLibroCellType(diffCellResultItem.origin)}
            </span>
            <span
              className="libro-diff-cell-header-origin-execute-count"
              style={{
                display: diffCellResultItem.origin.cell_type !== 'markdown' ? 'block' : 'none',
              }}
            >
              {diffCellResultItem.origin.execution_count
                ? '[' + diffCellResultItem.origin.execution_count?.toString() + ']'
                : '[ ]'}
            </span>
          </div>
          <div className={`libro-diff-cell-unchanged-target-header ${diffCellResultItem.diffType}`}>
            <span className="libro-diff-cell-header-text">
              {getLibroCellType(diffCellResultItem.target)}
            </span>
            <span
              className="libro-diff-cell-header-target-execute-count"
              style={{
                display: diffCellResultItem.target.cell_type !== 'markdown' ? 'block' : 'none',
              }}
            >
              {diffCellResultItem.target.execution_count
                ? '[' + diffCellResultItem.target.execution_count?.toString() + ']'
                : '[ ]'}
            </span>
          </div>
          <div className="libro-diff-cell-unchanged-content" ref={editorDiffRef} />
          <div className="libro-diff-cell-unchanged-origin-border" />
          <div className="libro-diff-cell-unchanged-target-border" />
        </div>
      </div>
    );
  },
);
