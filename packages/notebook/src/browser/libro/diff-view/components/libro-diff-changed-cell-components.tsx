import { useInject } from '@difizen/libro-common/app';
import React, { memo, useEffect, useRef, useState } from 'react';

import { IDiffEditor } from '@opensumi/ide-monaco';

import { getLibroCellType, getSource } from '../libro-diff-protocol';
import { LibroVersionManager } from '../libro-version-manager';

import { useEditorLayout } from './hooks';

import type { DiffEditorProps } from '../libro-diff-protocol';

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

export const LibroDiffChangedCellComponent: React.FC<DiffEditorProps> = memo(({ diffCellResultItem }) => {
  const editorDiffRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [diffEditor, setDiffEditor] = useState<IDiffEditor | undefined>();
  const versionManager = useInject(LibroVersionManager);
  useEffect(() => {
    if (!editorDiffRef.current) {
      return;
    }
    const language = diffCellResultItem.origin.metadata.libroCellType
      ? getEditorLanguage(diffCellResultItem.origin.metadata.libroCellType.toString())
      : getEditorLanguage(diffCellResultItem.origin.cell_type);
    const diffEditor = versionManager.createDiffEditor(
      getSource(diffCellResultItem.origin),
      getSource(diffCellResultItem.target),
      language,
      editorDiffRef.current,
    );
    setDiffEditor(diffEditor);
    return () => {
      diffEditor?.dispose();
    };
  }, [editorDiffRef]);

  useEditorLayout(diffEditor, editorDiffRef, editorContainerRef);

  const type = diffCellResultItem.diffType === 'changed' ? 'changed' : 'unchanged';

  return (
    <div className='libro-diff-cell-container' ref={editorContainerRef}>
      <div className={`libro-diff-cell-${type}-container`}>
        <div className={`libro-diff-cell-${type}-origin-header ${diffCellResultItem.diffType}`}>
          <span className='libro-diff-cell-header-text'>{getLibroCellType(diffCellResultItem.origin)}</span>
          <span
            className='libro-diff-cell-header-origin-execute-count'
            style={{
              display: diffCellResultItem.origin.cell_type !== 'markdown' ? 'block' : 'none',
            }}
          >
            {diffCellResultItem.origin.execution_count
              ? '[' + diffCellResultItem.origin.execution_count?.toString() + ']'
              : '[ ]'}
          </span>
        </div>
        <div className={`libro-diff-cell-${type}-target-header ${diffCellResultItem.diffType}`}>
          <span className='libro-diff-cell-header-text'>{getLibroCellType(diffCellResultItem.target)}</span>
          <span
            className='libro-diff-cell-header-target-execute-count'
            style={{
              display: diffCellResultItem.target.cell_type !== 'markdown' ? 'block' : 'none',
            }}
          >
            {diffCellResultItem.target.execution_count
              ? '[' + diffCellResultItem.target.execution_count?.toString() + ']'
              : '[ ]'}
          </span>
        </div>
        <div className={`libro-diff-cell-${type}-content`} ref={editorDiffRef} />
        <div className={`libro-diff-cell-${type}-origin-border`} />
        <div className={`libro-diff-cell-${type}-target-border`} />
      </div>
    </div>
  );
});
