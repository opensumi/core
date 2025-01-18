import { Container } from '@difizen/mana-app';
import React, { memo, useCallback, useEffect, useRef } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Schemes } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-editor';
import { URI } from '@opensumi/ide-utils';

import { ManaContainer } from '../../../mana';
import { getLibroCellType } from '../libro-diff-protocol';
import { LibroVersionManager } from '../libro-version-manager';

import { useSize } from './hooks';

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

export const LibroDiffAddedCellComponent: React.FC<DiffEditorProps> = memo(({ diffCellResultItem }) => {
  const manaContainer = useInjectable<Container>(ManaContainer);
  const libroVersionManager = manaContainer.get(LibroVersionManager);
  const editorTargetRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const language = diffCellResultItem.origin.metadata.libroCellType
    ? getEditorLanguage(diffCellResultItem.origin.metadata.libroCellType.toString())
    : getEditorLanguage(diffCellResultItem.origin.cell_type);

  const editorInstance = useRef<ICodeEditor>();

  const createEditor = async () => {
    // 这里其实已经拿到content了，但是 opensumi editor 需要uri，理论上有优化空间
    const uri = URI.parse(
      `${Schemes.notebookCell}:${diffCellResultItem.targetFilePath!}?cellId=${diffCellResultItem.target.id}`,
    );
    const editor = await libroVersionManager.createPreviewEditor(
      uri,
      language,
      editorTargetRef.current!,
      diffCellResultItem.diffType,
    );
    editorInstance.current = editor;
    setEditorHeight(editor);
  };

  const setEditorHeight = useCallback(
    (editor: ICodeEditor) => {
      const curLenght = editor.monacoEditor?.getModel()?.getLineCount() || 1;
      if (!editorTargetRef.current || !editorContainerRef.current) {
        return;
      }
      const diffItemHeight = `${curLenght * 20 + 16 + 12 + 22}px`;
      const _height = `${curLenght * 20}px`;
      if (editorTargetRef.current.style.height !== _height) {
        editorTargetRef.current.style.height = _height;
        editorContainerRef.current.style.height = diffItemHeight;
        editor.layout();
      }
    },
    [editorTargetRef.current, editorContainerRef.current],
  );
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

  useEffect(() => {
    if (!editorTargetRef.current) {
      return;
    }
    createEditor();
  }, [editorTargetRef]);
  return (
    <div className='libro-diff-cell-container' ref={editorContainerRef}>
      <div className={'libro-diff-cell-target-container'}>
        <div className={`libro-diff-cell-target-header ${diffCellResultItem.diffType}`}>
          <span className='libro-diff-cell-header-text'>{getLibroCellType(diffCellResultItem.origin)}</span>
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
        <div className='libro-diff-cell-target-content' ref={editorTargetRef} />
      </div>
    </div>
  );
});
