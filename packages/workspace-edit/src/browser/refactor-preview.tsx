import { observer } from 'mobx-react-lite';
import React from 'react';

import { CheckBox } from '@opensumi/ide-components/lib/checkbox';
import { RecycleList } from '@opensumi/ide-components/lib/recycle-list';
import { ViewState } from '@opensumi/ide-core-browser/lib/layout';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { LabelService } from '@opensumi/ide-core-browser/lib/services/label-service';
import { localize } from '@opensumi/ide-core-common/lib/localize';
import * as paths from '@opensumi/ide-core-common/lib/path';
import { URI, Uri } from '@opensumi/ide-core-common/lib/uri';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import type {
  ResourceFileEdit,
  ResourceTextEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import type { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IRefactorPreviewService } from './refactor-preview.service';
import styles from './refactor_preview.module.less';
import { isResourceFileEdit } from './utils';

interface IRefactorNodeProps {
  data: ResourceTextEdit | ResourceFileEdit;
  onClick: (item: ResourceTextEdit | ResourceFileEdit) => void;
}

interface ITextEditNodeProps {
  data: ResourceTextEdit;
  onClick: (item: ResourceTextEdit) => void;
}

interface IFileEditNodeProps {
  data: ResourceFileEdit;
  onClick: (item: ResourceFileEdit) => void;
}

/**
 * @param range
 * @param textModel
 * @example
 * ```ts
 * const str = `import path from 'path'`;
 *
 * const {
 *  leftPad,  // import * as
 *  base,     // path
 *  rightPad, // from 'path';
 * } = splitLeftAndRightPadInTextModel(range\/** path range *\/, model);
 * ```
 */
function splitLeftAndRightPadInTextModel(range: IRange, textModel: ITextModel) {
  const lineContent = textModel.getLineContent(range.startLineNumber);
  const base = textModel.getValueInRange(range);

  const leftPadRange = new monaco.Range(range.startLineNumber, 0, range.startLineNumber, range.startColumn);
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
  const modelService = useInjectable<IEditorDocumentModelService>(IEditorDocumentModelService);
  const refactorPreviewService = useInjectable<IRefactorPreviewService>(IRefactorPreviewService);

  const renderTextEditDiff = () => {
    const model = modelService.getModelReference(URI.from(item.resource));
    if (!model) {
      return <div className={styles.refactor_preview_node_wrapper}>{item.textEdit.text}</div>;
    }

    const textModel = model.instance.getMonacoModel();
    const { leftPad, base, rightPad } = splitLeftAndRightPadInTextModel(item.textEdit.range, textModel);

    return (
      <div className={styles.refactor_preview_node_wrapper}>
        {leftPad}
        <span className={styles.refactor_preview_node_base}>{base}</span>
        <span className={styles.refactor_preview_node_new}>{item.textEdit.text}</span>
        {rightPad}
      </div>
    );
  };

  return (
    <div className={styles.resource_node} data-workspace-edit-type='text'>
      <CheckBox
        checked={refactorPreviewService.selectedFileOrTextEdits.has(item)}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          refactorPreviewService.filterEdit(item, event.target.checked);
        }}
      />
      <ResourceIcon uri={item.resource as unknown as Uri /* monaco#Uri */} />
      {renderTextEditDiff()}
      <span className={styles.resource_node_path}>{item.resource.path}</span>
    </div>
  );
});

function mapDescForFileEdit(edit: ResourceFileEdit) {
  if (edit.newResource && edit.oldResource) {
    // rename
    return {
      uri: edit.newResource,
      desc: localize('refactor-preview.file.move'),
    };
  }
  if (edit.newResource && !edit.oldResource) {
    // create
    return {
      uri: edit.newResource,
      desc: localize('refactor-preview.file.create'),
    };
  }
  if (!edit.newResource && edit.oldResource) {
    return {
      uri: edit.oldResource,
      desc: localize('refactor-preview.file.delete'),
    };
  }
  return undefined;
}

const FileEditNode = observer<IFileEditNodeProps>(({ data: item }) => {
  const refactorPreviewService = useInjectable<IRefactorPreviewService>(IRefactorPreviewService);

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
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          refactorPreviewService.filterEdit(item, event.target.checked);
        }}
      />
      <ResourceIcon uri={editDesc.uri as unknown as Uri /* monaco#Uri */} />
      <span className={styles.refactor_preview_node_wrapper}>{filename}</span>
      <span className={styles.resource_node_path}>
        {dirname} ({editDesc.desc})
      </span>
    </div>
  );
});

const RefactorNode = observer<IRefactorNodeProps>(({ data, ...restProps }) => {
  if (isResourceFileEdit(data)) {
    return <FileEditNode data={data} {...restProps} />;
  }
  return <TextEditNode data={data} {...restProps} />;
});

export const RefactorPreview = observer(({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const refactorPreviewService = useInjectable<IRefactorPreviewService>(IRefactorPreviewService);

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
});
