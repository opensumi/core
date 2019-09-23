import { Injectable, Autowired } from '@ali/common-di';
import { IWorkspaceEditService, IResourceTextEdit, IWorkspaceEdit, IResourceFileEdit, ITextEdit } from '@ali/ide-workspace-edit';
import { URI, IRange } from '@ali/ide-core-common';
import { EndOfLineSequence, UriComponents } from '@ali/ide-editor';

@Injectable()
export class MonacoBulkEditService implements monaco.editor.IBulkEditService {

  @Autowired(IWorkspaceEditService)
  workspaceEditService: IWorkspaceEditService;

  protected getAriaSummary(totalEdits: number, totalFiles: number): string {
    if (totalEdits === 0) {
      return 'Made no edits';
    }
    if (totalEdits > 1 && totalFiles > 1) {
      return `Made ${totalEdits} text edits in ${totalFiles} files`;
    }
    return `Made ${totalEdits} text edits in one file`;
  }

  async apply(edit: monaco.languages.WorkspaceEdit): Promise<monaco.editor.IBulkEditResult> {
    try {
      const {workspaceEdit, totalEdits, totalFiles} = this.convertWorkspaceEdit(edit);
      await this.workspaceEditService.apply(workspaceEdit);
      return {
        ariaSummary: this.getAriaSummary(totalEdits, totalFiles),
      };
    } catch (err) {
      return { ariaSummary: `Error applying workspace edits: ${err.toString()}` };
    }
  }

  private convertWorkspaceEdit(edit: monaco.languages.WorkspaceEdit): {workspaceEdit: IWorkspaceEdit, totalEdits: number, totalFiles: number} {
    const workspaceEdit: IWorkspaceEdit = { edits: [] };
    let totalEdits = 0;
    let totalFiles = 0;
    for (const resourceEdit of edit.edits) {
      if ((resourceEdit as monaco.languages.ResourceTextEdit).resource) {
        const resourceTextEdit = resourceEdit as monaco.languages.ResourceTextEdit;
        const tmp: IResourceTextEdit = {
          // TODO 类型定义有问题，拿到的是URIComponents并不是monaco.Uri
          resource: URI.from(resourceTextEdit.resource as UriComponents),
          edits: resourceTextEdit.edits as ITextEdit[],
        };
        workspaceEdit.edits.push(tmp);
        totalEdits += 1;
      } else {
        const resourceFileEdit = resourceEdit as monaco.languages.ResourceFileEdit;
        const { oldUri, newUri, options } = resourceFileEdit;
        const tmp: IResourceFileEdit = {
          oldUri: oldUri ? URI.from(oldUri as UriComponents) : undefined,
          newUri: newUri ? URI.from(newUri as UriComponents) : undefined,
          options,
        };
        workspaceEdit.edits.push(tmp);
        totalFiles += 1;
      }
    }
    return {workspaceEdit, totalEdits, totalFiles};
  }
}
