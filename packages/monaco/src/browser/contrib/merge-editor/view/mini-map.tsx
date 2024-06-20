import cls from 'classnames';
import React, { useCallback, useEffect } from 'react';

import { Disposable, Event, useInjectable } from '@opensumi/ide-core-browser';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';

import { MergeEditorService } from '../merge-editor.service';
import { LineRange } from '../model/line-range';
import { EditorViewType } from '../types';

import { BaseCodeEditor } from './editors/baseCodeEditor';
import styles from './merge-editor.module.less';

interface BlockPiece {
  top: string;
  height: string;
  className: string;
}

export const MiniMap: React.FC<{ contrastType: EditorViewType }> = ({ contrastType }) => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);
  const [blocks, setBlocks] = React.useState<BlockPiece[]>([]);

  useEffect(() => {
    const disposables = new Disposable();

    disposables.addDispose(
      mergeEditorService.onDidMount((data) => {
        const { currentView, incomingView } = data;

        if (contrastType === EditorViewType.CURRENT) {
          disposables.addDispose(
            Event.debounce(
              currentView.onDidChangeDecorations,
              () => {},
              16,
            )(() => {
              computePiece(currentView, currentView.documentMapping.getOriginalRange());
            }),
          );
        } else if (contrastType === EditorViewType.INCOMING) {
          disposables.addDispose(
            Event.debounce(
              incomingView.onDidChangeDecorations,
              () => {},
              16,
            )(() => {
              computePiece(incomingView, incomingView.documentMapping.getModifiedRange());
            }),
          );
        }
      }),
    );

    return () => disposables.dispose();
  }, [mergeEditorService, contrastType]);

  const computePiece = useCallback((viewEditor: BaseCodeEditor, ranges: LineRange[]) => {
    const editor = viewEditor.getEditor();

    const lineHeight = editor.getOption(EditorOption.lineHeight);
    const contentHeight = editor.getContentHeight();
    const blocks: BlockPiece[] = [];

    ranges.forEach((range) => {
      if (range.isComplete) {
        return;
      }

      blocks.push({
        top: (((range.startLineNumber - 1) * lineHeight) / contentHeight) * 100 + '%',
        height: ((range.length * lineHeight) / contentHeight) * 100 + '%',
        className: styles[range.type],
      });
    });

    setBlocks(blocks);
  }, []);

  return (
    <div className={styles.minimap_content}>
      {blocks.map((block, i) => (
        <span
          key={i}
          className={cls(styles.block, block.className)}
          style={{ top: block.top, height: block.height }}
        ></span>
      ))}
    </div>
  );
};
