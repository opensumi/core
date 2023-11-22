import { Injectable, Autowired } from '@opensumi/di';
import { URI, ILogger, revive } from '@opensumi/ide-core-common';
import { UriComponents } from '@opensumi/ide-editor';
import {
  ResourceEdit,
  ResourceFileEdit,
  ResourceTextEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import type {
  IBulkEditPreviewHandler,
  IBulkEditResult,
  IBulkEditService,
  IBulkEditOptions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import { WorkspaceEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IWorkspaceEdit, IWorkspaceEditService, IResourceTextEdit, IResourceFileEdit } from '../common';

import { isResourceFileEdit, isResourceTextEdit } from './utils';

function reviveWorkspaceEditDto2(data: ResourceEdit[] | WorkspaceEdit | undefined): ResourceEdit[] {
  if (!data) {
    return [];
  }

  const edits = Array.isArray(data) ? data : data.edits;
  const result: ResourceEdit[] = [];

  for (const edit of revive(edits)) {
    if (isResourceFileEdit(edit)) {
      result.push(new ResourceFileEdit(edit.oldResource, edit.newResource, edit.options, edit.metadata));
    } else if (isResourceTextEdit(edit)) {
      result.push(new ResourceTextEdit(edit.resource, edit.textEdit, edit.versionId, edit.metadata));
    }
  }
  return result;
}

@Injectable()
export class MonacoBulkEditService implements IBulkEditService {
  _serviceBrand: undefined;

  @Autowired(IWorkspaceEditService)
  workspaceEditService: IWorkspaceEditService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private _previewHandler?: IBulkEditPreviewHandler;

  protected getAriaSummary(totalEdits: number, totalFiles: number): string {
    if (totalEdits === 0) {
      return 'Made no edits';
    }
    if (totalEdits > 1 && totalFiles > 1) {
      return `Made ${totalEdits} text edits in ${totalFiles} files`;
    }
    return `Made ${totalEdits} text edits in one file`;
  }

  async apply(
    resourceEdits: ResourceEdit[] | WorkspaceEdit,
    options?: IBulkEditOptions,
  ): Promise<IBulkEditResult & { success: boolean }> {
    let edits = reviveWorkspaceEditDto2(resourceEdits);

    if ((options?.showPreview || edits.some((edit) => edit.metadata?.needsConfirmation)) && this._previewHandler) {
      try {
        edits = await this._previewHandler(edits, options);
      } catch (err) {
        this.logger.error(`Handle refactor preview error: \n ${err.message || err}`);
        return { ariaSummary: err.message, success: false };
      }
    }

    try {
      const { workspaceEdit, totalEdits, totalFiles } = this.convertWorkspaceEdit(edits);
      await this.workspaceEditService.apply(workspaceEdit);
      return {
        ariaSummary: this.getAriaSummary(totalEdits, totalFiles),
        success: true,
      };
    } catch (err) {
      const errMsg = `Error applying workspace edits: ${err.toString()}`;
      this.logger.error(errMsg);
      return { ariaSummary: errMsg, success: false };
    }
  }

  hasPreviewHandler(): boolean {
    return Boolean(this._previewHandler);
  }

  setPreviewHandler(handler: IBulkEditPreviewHandler): monaco.IDisposable {
    this._previewHandler = handler;

    const disposePreviewHandler = () => {
      if (this._previewHandler === handler) {
        this._previewHandler = undefined;
      }
    };

    return {
      dispose(): void {
        disposePreviewHandler();
      },
    };
  }

  private convertWorkspaceEdit(edit: ResourceEdit[]): {
    workspaceEdit: IWorkspaceEdit;
    totalEdits: number;
    totalFiles: number;
  } {
    const workspaceEdit: IWorkspaceEdit = { edits: [] };
    let totalEdits = 0;
    let totalFiles = 0;
    for (const resourceEdit of edit) {
      if ((resourceEdit as IResourceTextEdit).resource) {
        const resourceTextEdit = resourceEdit as IResourceTextEdit;
        const tmp: IResourceTextEdit = {
          resource: URI.from(resourceTextEdit.resource as unknown as UriComponents),
          textEdit: resourceTextEdit.textEdit,
          options: {
            dirtyIfInEditor: true,
          },
        };
        workspaceEdit.edits.push(tmp);
        totalEdits += 1;
      } else {
        const resourceFileEdit = resourceEdit as ResourceFileEdit;
        const { oldResource, newResource, options = {} } = resourceFileEdit;
        const tmp: IResourceFileEdit = {
          oldResource: oldResource ? URI.from(oldResource as UriComponents) : undefined,
          newResource: newResource ? URI.from(newResource as UriComponents) : undefined,
          options,
        };
        workspaceEdit.edits.push(tmp);
        totalFiles += 1;
      }
    }
    return { workspaceEdit, totalEdits, totalFiles };
  }
}
