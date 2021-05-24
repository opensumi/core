import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import type { WorkspaceTextEdit, WorkspaceFileEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import type { IRange } from '@ali/monaco-editor-core/esm/vs/editor/common/core/range';
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import * as paths from '@ali/ide-core-common/lib/path';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser/doc-model/types';
import { URI, Uri } from '@ali/ide-core-common/lib/uri';
import { RecycleList } from '@ali/ide-components/lib/recycle-list';
import { CheckBox } from '@ali/ide-components/lib/checkbox';
import { LabelService } from '@ali/ide-core-browser/lib/services/label-service';
import { ViewState } from '@ali/ide-core-browser/lib/layout';

import {
  IRefactorPreviewService,
} from './refactor-preview.service';
import * as styles from './refactor_preview.module.less';
import { localize } from '@ali/ide-core-common/lib/localize';
import { isWorkspaceFileEdit } from './utils';

interface IRefactorNodeProps {
  data: WorkspaceTextEdit | WorkspaceFileEdit;
  onClick: (item: WorkspaceTextEdit | WorkspaceFileEdit) => void;
}

interface ITextEditNodeProps {
  data: WorkspaceTextEdit;
  onClick: (item: WorkspaceTextEdit) => void;
}

interface IFileEditNodeProps {
  data: WorkspaceFileEdit;
  onClick: (item: WorkspaceFileEdit) => void;
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

const ResourceIcon: React.FC<{ uri: Uri }> = (props) => {
  const labelService = useInjectable<LabelService>(LabelService);
  const iconClass = labelService.getIcon(URI.from(props.uri));
  return <span className={`file-icon ${iconClass}`} />;
};

const TextEditNode = observer<ITextEditNodeProps>(({ data: item }) => {
  const modelService = useInjectable<IEditorDocumentModelService>(
    IEditorDocumentModelService,
  );
  const refactorPreviewService = useInjectable<IRefactorPreviewService>(
    IRefactorPreviewService,
  );

  const renderTextEditDiff = () => {
    const model = modelService.getModelReference(URI.from(item.resource));
    if (!model) {
      return <div className={styles.refactor_preview_node_wrapper}>{item.edit.text}</div>;
    }

    const textModel = model.instance.getMonacoModel();
    const { leftPad, base, rightPad } = splitLeftAndRightPadInTextModel(
      item.edit.range,
      textModel,
    );

    return (
      <div className={styles.refactor_preview_node_wrapper}>
        {leftPad}
        <span className={styles.refactor_preview_node_base}>{base}</span>
        <span className={styles.refactor_preview_node_new}>
          {item.edit.text}
        </span>
        {rightPad}
      </div>
    );
  };

  return (
    <div className={styles.resource_node} data-workspace-edit-type='text'>
      <CheckBox
        checked={refactorPreviewService.selectedFileOrTextEdits.has(item)}
        onChange={(checked: React.ChangeEvent<HTMLInputElement>) => {
          refactorPreviewService.filterEdit(item, !!checked);
        }}
      />
      <ResourceIcon uri={item.resource as unknown as Uri /* monaco#Uri */} />
      {renderTextEditDiff()}
      <span className={styles.resource_node_path}>{item.resource.path}</span>
    </div>
  );
});

function mapDescForFileEdit(edit: WorkspaceFileEdit) {
  if (edit.newUri && edit.oldUri) {
    // rename
    return {
      uri: edit.newUri,
      desc: localize('refactor-preview.file.move'),
    };
  }
  if (edit.newUri && !edit.oldUri) {
    // create
    return {
      uri: edit.newUri,
      desc: localize('refactor-preview.file.create'),
    };
  }
  if (!edit.newUri && edit.oldUri) {
    return {
      uri: edit.oldUri,
      desc: localize('refactor-preview.file.delete'),
    };
  }
  return undefined;
}

const FileEditNode = observer<IFileEditNodeProps>(({ data: item }) => {
  const refactorPreviewService = useInjectable<IRefactorPreviewService>(
    IRefactorPreviewService,
  );

  const editDesc = mapDescForFileEdit(item);
  if (editDesc === undefined) {
    return null;
  }

  const filename = paths.basename(editDesc.uri.fsPath);
  const dirname = paths.dirname(editDesc.uri.fsPath);

  return (
    <div className={styles.resource_node} data-workspace-edit-type='file'>
      <CheckBox
        checked={refactorPreviewService.selectedFileOrTextEdits.has(item)}
        onChange={(checked: React.ChangeEvent<HTMLInputElement>) => {
          refactorPreviewService.filterEdit(item, !!checked);
        }}
      />
      <ResourceIcon uri={editDesc.uri as unknown as Uri /* monaco#Uri */} />
      <span className={styles.refactor_preview_node_wrapper}>{filename}</span>
      <span className={styles.resource_node_path}>{dirname} ({editDesc.desc})</span>
    </div>
  );
});

const RefactorNode = observer<IRefactorNodeProps>(({ data, ...restProps }) => {
  if (isWorkspaceFileEdit(data)) {
    return <FileEditNode data={data} {...restProps} />;
  }
  return <TextEditNode data={data} {...restProps} />;
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
