import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { IBulkEditPreviewHandler, IBulkEditResult, IBulkEditService, IBulkEditOptions } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import { Injectable, Autowired } from '@ali/common-di';
import { URI, ILogger } from '@ali/ide-core-common';
import { UriComponents } from '@ali/ide-editor';
import { IWorkspaceEdit, IWorkspaceEditService, IResourceTextEdit, ITextEdit, IResourceFileEdit } from '../';

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

  async apply(edit: monaco.languages.WorkspaceEdit, options?: IBulkEditOptions): Promise<IBulkEditResult & { success: boolean }> {
    let edits = edit;

    if (options?.showPreview && this._previewHandler) {
      try {
        edits = await this._previewHandler(edit, options);
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

  private convertWorkspaceEdit(edit: monaco.languages.WorkspaceEdit): { workspaceEdit: IWorkspaceEdit, totalEdits: number, totalFiles: number } {
    const workspaceEdit: IWorkspaceEdit = { edits: [] };
    let totalEdits = 0;
    let totalFiles = 0;
    for (const resourceEdit of edit.edits) {
      if ((resourceEdit as monaco.languages.WorkspaceTextEdit).resource) {
        const resourceTextEdit = resourceEdit as monaco.languages.WorkspaceTextEdit;
        const tmp: IResourceTextEdit = {
          // TODO 类型定义有问题，拿到的是URIComponents并不是monaco.Uri
          resource: URI.from(resourceTextEdit.resource as UriComponents),
          edit: resourceTextEdit.edit as ITextEdit,
          options: {
            dirtyIfInEditor: true,
          },
        };
        workspaceEdit.edits.push(tmp);
        totalEdits += 1;
      } else {
        const resourceFileEdit = resourceEdit as monaco.languages.WorkspaceFileEdit;
        const { oldUri, newUri, options = {} } = resourceFileEdit;
        const tmp: IResourceFileEdit = {
          oldUri: oldUri ? URI.from(oldUri as UriComponents) : undefined,
          newUri: newUri ? URI.from(newUri as UriComponents) : undefined,
          options,
        };
        workspaceEdit.edits.push(tmp);
        totalFiles += 1;
      }
    }
    return { workspaceEdit, totalEdits, totalFiles };
  }
}
