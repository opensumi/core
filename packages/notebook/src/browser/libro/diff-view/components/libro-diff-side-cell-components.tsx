import { Container } from '@difizen/libro-common/app';
import React, { memo, useEffect, useRef, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { ManaContainer } from '../../../mana';
import { getLibroCellType } from '../libro-diff-protocol';
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

export const LibroDiffSideCellComponent: React.FC<DiffEditorProps> = memo(({ diffCellResultItem }) => {
  const manaContainer = useInjectable<Container>(ManaContainer);
  const libroVersionManager = manaContainer.get(LibroVersionManager);
  const editorTargetRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const language = diffCellResultItem.origin.metadata.libroCellType
    ? getEditorLanguage(diffCellResultItem.origin.metadata.libroCellType.toString())
    : getEditorLanguage(diffCellResultItem.origin.cell_type);

  const [editor, setEditor] = useState<ICodeEditor | undefined>();

  const createEditor = () => {
    // 这里其实已经拿到content了，但是 opensumi editor 需要uri，理论上有优化空间
    const content =
      diffCellResultItem.diffType === 'removed' ? diffCellResultItem.origin.source : diffCellResultItem.target.source;
    const previewedEditor = libroVersionManager.createPreviewEditor(
      content.toString(),
      language,
      editorTargetRef.current!,
      diffCellResultItem.diffType,
    );
    setEditor(previewedEditor);
    return previewedEditor;
  };

  useEditorLayout(editor, editorTargetRef, editorContainerRef);

  useEffect(() => {
    if (!editorTargetRef.current) {
      return;
    }
    const previewedEditor = createEditor();
    return () => {
      previewedEditor?.dispose();
    };
  }, [editorTargetRef.current]);
  const type = diffCellResultItem.diffType === 'removed' ? 'origin' : 'target';
  return (
    <div className='libro-diff-cell-container' ref={editorContainerRef}>
      <div className={`libro-diff-cell-${type}-container`}>
        <div className={`libro-diff-cell-${type}-header`}>
          <span className='libro-diff-cell-header-text'>{getLibroCellType(diffCellResultItem.origin)}</span>
          <span
            className={`libro-diff-cell-header-${type}-execute-count`}
            style={{
              display: diffCellResultItem.target.cell_type !== 'markdown' ? 'block' : 'none',
            }}
          >
            {diffCellResultItem.target.execution_count
              ? '[' + diffCellResultItem.target.execution_count?.toString() + ']'
              : '[ ]'}
          </span>
        </div>
        <div className={`libro-diff-cell-${type}-content`} ref={editorTargetRef} />
      </div>
    </div>
  );
});
