import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import type { WorkspaceTextEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import type { IRange } from '@ali/monaco-editor-core/esm/vs/editor/common/core/range';
import * as React from 'react';
import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';

import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser/doc-model/types';
import { URI } from '@ali/ide-core-common/lib/uri';
import { RecycleList } from '@ali/ide-components/lib/recycle-list';
import { CheckBox } from '@ali/ide-components/lib/checkbox';
import { LabelService } from '@ali/ide-core-browser/lib/services/label-service';
import { ViewState } from '@ali/ide-core-browser/lib/layout';

import {
  FilterEditKind,
  IRefactorPreviewService,
} from './refactor-preview.service';
import * as styles from './refactor_preview.module.less';

interface IRefactorNodeProps {
  data: WorkspaceTextEdit;
  onClick: (item: WorkspaceTextEdit) => void;
}

/**
 * @param range
 * @param textModel
 * @example
 * ```ts
 * const str = `import * as path from 'path'`;
 *
 * const {
 *  leftPad,  // import * as
 *  base,     // path
 *  rightPad, // from 'path';
 * } = splitLeftAndRightPadInTextModel(range\/** path range *\/, model);
 * ```
 */
function splitLeftAndRightPadInTextModel(
  range: IRange,
  textModel: monaco.editor.ITextModel,
) {
  const lineContent = textModel.getLineContent(range.startLineNumber);
  const base = textModel.getValueInRange(range);

  const leftPadRange = new monaco.Range(
    range.startLineNumber,
    0,
    range.startLineNumber,
    range.startColumn,
  );
  const rightPadRange = new monaco.Range(
    range.endLineNumber,
    range.startColumn + base.length,
    range.endLineNumber,
    lineContent.length + 1,
  );

  const leftPad = textModel.getValueInRange(leftPadRange);
  const rightPad = textModel.getValueInRange(rightPadRange);

  return {
    leftPad,
    rightPad,
    base,
  };
}

const RefactorNode = observer(({ data: item }: IRefactorNodeProps) => {
  const modelService = useInjectable<IEditorDocumentModelService>(
    IEditorDocumentModelService,
  );
  const labelService = useInjectable<LabelService>(LabelService);
  const refactorPreviewService = useInjectable<IRefactorPreviewService>(
    IRefactorPreviewService,
  );

  const onCheckboxChange = useCallback(
    (checked: boolean) => {
      refactorPreviewService.filterEdit(
        item,
        checked ? FilterEditKind.added : FilterEditKind.removed,
      );
    },
    [item],
  );

  const renderResourceIcon = (node: WorkspaceTextEdit) => {
    const iconClass = labelService.getIcon(URI.from(node.resource));
    return <span className={`file-icon ${iconClass}`} />;
  };

  const renderTextEditDiff = () => {
    const model = modelService.getModelReference(URI.from(item.resource));
    if (!model) {
      return item.edit.text;
    }

    const textModel = model.instance.getMonacoModel();
    const { leftPad, base, rightPad } = splitLeftAndRightPadInTextModel(
      item.edit.range,
      textModel,
    );

    return (
      <p className={styles.refactor_preview_node_diff}>
        {leftPad}
        <span className={styles.refactor_preview_node_base}>{base}</span>
        <span className={styles.refactor_preview_node_new}>
          {item.edit.text}
        </span>
        {rightPad}
      </p>
    );
  };

  return (
    <div
      className={styles.resource_node}
      key={`${item.resource.path}-${item.edit.text}`}
    >
      <CheckBox
        checked={refactorPreviewService.checkedStore[refactorPreviewService.generateTextEditId(item)] === FilterEditKind.added}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onCheckboxChange(e.target.checked)
        }
      />
      {renderResourceIcon(item)}
      {renderTextEditDiff()}
      <span className={styles.resource_node_path}>{item.resource.path}</span>
    </div>
  );
});

export const RefactorPreview = observer(
  ({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
    const refactorPreviewService = useInjectable<IRefactorPreviewService>(
      IRefactorPreviewService,
    );

    return (
      <div>
        {refactorPreviewService.edits.length > 0 && (
          <RecycleList
            itemHeight={23}
            width={viewState.width}
            height={viewState.height}
            data={refactorPreviewService.edits}
            template={RefactorNode}
          />
        )}
      </div>
    );
  },
);
