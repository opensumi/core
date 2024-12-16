
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

export const LibroDiffAddedCellComponent: React.FC<DiffEditorProps> = memo(
  ({ diffCellResultItem }) => {
    const editorTargetRef = useRef<HTMLDivElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const language = diffCellResultItem.origin.metadata.libroCellType
      ? getEditorLanguage(diffCellResultItem.origin.metadata.libroCellType.toString())
      : getEditorLanguage(diffCellResultItem.origin.cell_type);

    const innerEditorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
    const editorInstance = innerEditorRef;

    const setEditorHeight = useCallback(() => {
      const curLenght = editorInstance.current?.getModel()?.getLineCount() || 1;
      if (!editorTargetRef.current || !editorContainerRef.current) return;
      const diffItemHeight = `${curLenght * 20 + 16 + 12 + 22}px`;
      const _height = `${curLenght * 20}px`;
      if (editorTargetRef.current.style.height !== _height) {
        editorTargetRef.current.style.height = _height;
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
    // FIXME: 实现有点问题，需要看下，Libro 和 OpenSumi 的 editor 的关系
    MonacoEnvironment.init().then(async () => {
      const editorPorvider = MonacoEnvironment.container.get<EditorProvider>(EditorProvider);

      if (!editorTargetRef || !editorTargetRef.current) return;
      const codeValue = getSource(diffCellResultItem.target);
      const editorDom = editorTargetRef.current;
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
        scrollBeyondLastLine: false,
        renderFinalNewline: false,
        renderLineHighlight: 'none',
        readOnly: true,
        // scrollBeyondLastColumn: 2,
        extraEditorClassName: `libro-diff-editor-${diffCellResultItem.diffType}`,
      }).codeEditor;
      setEditorHeight();
    });
    return (
      <div className="libro-diff-cell-container" ref={editorContainerRef}>
        <div className={`libro-diff-cell-target-container`}>
          <div className={`libro-diff-cell-target-header ${diffCellResultItem.diffType}`}>
            <span className="libro-diff-cell-header-text">
              {getLibroCellType(diffCellResultItem.origin)}
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
          <div className="libro-diff-cell-target-content" ref={editorTargetRef} />
        </div>
      </div>
    );
  },
);
