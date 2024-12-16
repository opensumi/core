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

export const LibroDiffRemovedCellComponent: React.FC<DiffEditorProps> = memo(
  ({ diffCellResultItem }) => {
    const editorOriginRef = useRef<HTMLDivElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const language = diffCellResultItem.origin.metadata.libroCellType
      ? getEditorLanguage(diffCellResultItem.origin.metadata.libroCellType.toString())
      : getEditorLanguage(diffCellResultItem.origin.cell_type);

    const innerEditorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
    const editorInstance = innerEditorRef;

    const setEditorHeight = useCallback(() => {
      const curLenght = editorInstance.current?.getModel()?.getLineCount() || 1;
      if (!editorOriginRef.current || !editorContainerRef.current) return;
      const diffItemHeight = `${curLenght * 20 + 12 + 16 + 22}px`;
      const _height = `${curLenght * 20}px`;
      if (editorOriginRef.current.style.height !== _height) {
        editorOriginRef.current.style.height = _height;
        editorContainerRef.current.style.height = diffItemHeight;
        editorInstance.current?.layout();
      }
    }, [editorInstance]);

    const editorLaylout = () => {
      if (editorInstance.current) {
        editorInstance.current.layout();
      }
    };

    useEffect(() => {
      window.addEventListener('resize', editorLaylout);
      return () => {
        window.removeEventListener('resize', editorLaylout);
      };
    }, [editorInstance]);

    useSize(editorLaylout, editorContainerRef);

    MonacoEnvironment.init().then(async () => {
      const editorPorvider = MonacoEnvironment.container.get<EditorProvider>(EditorProvider);
      if (!editorOriginRef || !editorOriginRef.current) return;
      const codeValue = getSource(diffCellResultItem.origin);
      const editorDom = editorOriginRef.current;
      editorInstance.current = editorPorvider.create(editorDom, {
        language: language,
        minimap: {
          enabled: false,
        },
        automaticLayout: false,
        value: codeValue,
        fontSize: 13,
        folding: true,
        wordWrap: 'off',
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
        scrollbar: {
          vertical: 'hidden',
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 0,
          horizontal: 'visible',
          horizontalScrollbarSize: 0,
        },
        glyphMargin: true,
        renderFinalNewline: false,
        scrollBeyondLastLine: false,
        readOnly: true,
        // scrollBeyondLastColumn: 2,
        renderLineHighlight: 'none',
        extraEditorClassName: `libro-diff-editor-${diffCellResultItem.diffType}`,
      }).codeEditor;
      setEditorHeight();

      // }
    });
    return (
      <div className="libro-diff-cell-container" ref={editorContainerRef}>
        <div className="libro-diff-cell-origin-container">
          <div
            className={`libro-diff-cell-origin-header ${diffCellResultItem.diffType}`}
            style={{
              display: diffCellResultItem.diffType !== 'added' ? 'block' : 'none',
            }}
          >
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
          <div className="libro-diff-cell-origin-content" ref={editorOriginRef} />
        </div>
      </div>
    );
  },
);
