import { IResourceTextEdit, ITextEdit, IWorkspaceEditService, IWorkspaceEdit, IResourceFileEdit, WorkspaceEditDidRenameFileEvent } from '../common';
import { URI, IEventBus } from '@ali/ide-core-browser';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { Injectable, Autowired } from '@ali/common-di';
import { EndOfLineSequence, WorkbenchEditorService, EOL } from '@ali/ide-editor';
import { runInAction } from 'mobx';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { IMonacoImplEditor } from '@ali/ide-editor/lib/browser/editor-collection.service';

type WorkspaceEdit = ResourceTextEdit | ResourceFileEdit;

@Injectable()
export class WorkspaceEditServiceImpl implements IWorkspaceEditService {

  private editStack: BulkEdit[] = [];

  @Autowired(IEditorDocumentModelService)
  documentModelService: IEditorDocumentModelService;

  @Autowired(IFileServiceClient)
  fileSystemService: IFileServiceClient;

  @Autowired()
  editorService: WorkbenchEditorService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  async apply(edit: IWorkspaceEdit): Promise<void> {
    const bulkEdit = new BulkEdit();
    edit.edits.forEach((edit) => {
      bulkEdit.add(edit);
    });
    bulkEdit.apply(this.documentModelService, this.fileSystemService, this.editorService, this.eventBus);
    this.editStack.push(bulkEdit);
  }

  revertTopFileEdit(): Promise<void> {
    // TODO
    throw new Error('Method not implemented.');
  }

}

export class BulkEdit {

  private edits: WorkspaceEdit[] = [];

  async apply(documentModelService: IEditorDocumentModelService, fileSystemService: IFileServiceClient, editorService: WorkbenchEditorService, eventBus: IEventBus) {
    for (const edit of this.edits) {
      if (edit instanceof ResourceFileEdit) {
        await edit.apply(editorService, fileSystemService, documentModelService, eventBus);
      } else {
        await edit.apply(documentModelService, editorService);
      }
    }
  }

  add(edit: IResourceTextEdit | IResourceFileEdit) {
    if (isResourceFileEdit(edit)) {
      this.edits.push(new ResourceFileEdit(edit));
    } else {
      const last = this.edits[this.edits.length - 1];
      const textEdit = edit as IResourceTextEdit;
      if (last && !isResourceFileEdit(last)) {
        // 合并连续同目标的edits
        if (last.resource.toString() === textEdit.resource.toString()) {
          let shouldMerge = false;
          if (last.modelVersionId) {
            if (textEdit.modelVersionId ) {
              shouldMerge = textEdit.modelVersionId === last.modelVersionId;
            } else {
              shouldMerge = true;
            }
          } else {
            if (!textEdit.modelVersionId) {
              shouldMerge = true;
            }
          }
          if (shouldMerge) {
            (last as IResourceTextEdit).edits = (last as IResourceTextEdit).edits.concat(textEdit.edits);
            return;
          }
        }
      }
      this.edits.push(new ResourceTextEdit(edit as IResourceTextEdit));
    }
  }

  revert(onlyFileEdits: true) {
    // TODO
  }

}

export class ResourceTextEdit implements IResourceTextEdit {

  resource: URI;
  modelVersionId: number | undefined;
  edits: ITextEdit[];
  options: {
    openDirtyInEditor?: boolean
    dirtyIfInEditor?: boolean,
  } = {};

  constructor(edit: IResourceTextEdit) {
    this.resource = edit.resource;
    this.modelVersionId = edit.modelVersionId,
    this.edits = edit.edits;
    this.options = edit.options || {};
  }

  async apply(documentModelService: IEditorDocumentModelService, editorService: WorkbenchEditorService): Promise<void> {
    const docRef = await documentModelService.createModelReference(this.resource, 'bulk-edit');
    const monacoModel = docRef.instance.getMonacoModel();
    if (this.modelVersionId) {
      if (monacoModel.getVersionId() !== this.modelVersionId) {
        throw new Error('文档版本不一致，无法执行变更');
      }
    }
    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    let newEOL: EndOfLineSequence | null = null;
    for (const edit of this.edits) {
      if (edit.eol) {
        newEOL = edit.eol;
      }
      edits.push({
        range: monaco.Range.lift(edit.range),
        text: edit.text,
      });
    }
    if (edits.length > 0) {
      monacoModel.pushStackElement();
      monacoModel.pushEditOperations([], edits, () => []);
      monacoModel.pushStackElement();
    }
    if (newEOL) {
      monacoModel.pushStackElement();
      monacoModel.setEOL(newEOL as any);
      monacoModel.pushStackElement();
    }
    const shouldSave = await this.editorOperation(editorService);
    if (shouldSave) {
      docRef.instance.save();
    }
    docRef.dispose();
  }

  async focusEditor(editorService: WorkbenchEditorService) {
    if (editorService.currentEditor && editorService.currentResource && editorService.currentResource.uri.isEqual(this.resource)) {
      (editorService.currentEditor as IMonacoImplEditor).monacoEditor.focus();
    }
  }

  // 返回是否保存
  async editorOperation(editorService: WorkbenchEditorService): Promise<boolean> {
    if (this.options.openDirtyInEditor) {
      for (const group of editorService.editorGroups) {
        if (group.resources.findIndex((r) => r.uri.isEqual(this.resource)) !== -1) {
          this.focusEditor(editorService);
          return false;
        }
      }
      editorService.open(this.resource, { backend: true});
      this.focusEditor(editorService);
      return false;
    } else if (this.options.dirtyIfInEditor) {
      for (const group of editorService.editorGroups) {
        if (group.resources.findIndex((r) => r.uri.isEqual(this.resource)) !== -1) {
          this.focusEditor(editorService);
          return false;
        }
      }
      this.focusEditor(editorService);
    }
    return true;
  }

  async revert(): Promise<void> {
    // TODO
  }

}

export class ResourceFileEdit implements IResourceFileEdit {

  oldUri?: URI;
  newUri?: URI;
  options: {
    overwrite?: boolean | undefined;
    ignoreIfNotExists?: boolean | undefined;
    ignoreIfExists?: boolean | undefined;
    recursive?: boolean | undefined;
    showInEditor?: boolean;
    isDirectory?: boolean;
  } = {};

  constructor(edit: IResourceFileEdit) {
    this.oldUri = edit.oldUri;
    this.newUri = edit.newUri;
    this.options = edit.options;
  }

  async apply(editorService: WorkbenchEditorService, fileSystemService: IFileServiceClient, documentModelService: IEditorDocumentModelService, eventBus: IEventBus ) {
    const options = this.options || {};

    if (this.newUri && this.oldUri) {
      await fileSystemService.move(this.oldUri.toString(), this.newUri.toString(), options);
      if (this.options.isDirectory) {
        return;
      }
      // rename
      if (options.overwrite === undefined && options.ignoreIfExists && await fileSystemService.exists(this.newUri.toString())) {
        return; // not overwriting, but ignoring, and the target file exists
      }
      const docRef = documentModelService.getModelReference(this.oldUri, 'bulk-file-move');
      let dirtyContent: string | undefined;
      let dirtyEOL: EOL | undefined;
      if (docRef && docRef.instance.dirty) {
        dirtyContent = docRef.instance.getText();
        dirtyEOL = docRef.instance.eol;
        docRef.instance.revert();
      }
      if (docRef) {
        docRef.dispose();
      }
      // 如果之前的文件在编辑器中被打开，重新打开文件
      await Promise.all([editorService.editorGroups.map(async (g) => {
        const index = g.resources.findIndex((r) => r.uri.isEqual(this.oldUri!));
        if (index !== -1) {
          await runInAction(async () => {
            await g.open(this.newUri!, {
              index,
              backend: !(g.currentResource && g.currentResource.uri.isEqual(this.oldUri!)),
            });
            await g.close(this.oldUri!);
          });
        }
      })]);

      if (dirtyContent) {
        const newDocRef = await documentModelService.createModelReference(this.newUri, 'bulk-file-move');
        newDocRef.instance.updateContent(dirtyContent, dirtyEOL);
        newDocRef.dispose();
      }

      eventBus.fire(new WorkspaceEditDidRenameFileEvent({oldUri: this.oldUri, newUri: this.newUri}));

    } else if (!this.newUri && this.oldUri) {
      // delete file
      if (await fileSystemService.exists(this.oldUri.toString())) {
        // 开天中默认recursive
        await fileSystemService.delete(this.oldUri.toString(), { moveToTrash: false });
      } else if (!options.ignoreIfNotExists) {
        throw new Error(`${this.oldUri} does not exist and can not be deleted`);
      }
    } else if (this.newUri && !this.oldUri) {
      // create file
      if (options.overwrite === undefined && options.ignoreIfExists && await fileSystemService.exists(this.newUri.toString())) {
        return; // not overwriting, but ignoring, and the target file exists
      }
      await fileSystemService.createFile(this.newUri.toString(), { content: '', overwrite: options.overwrite });
      if (options.showInEditor) {
        editorService.open(this.newUri);
      }
    }
  }

  async revert(): Promise<void> {
    // TODO
  }
}

export function isResourceFileEdit(thing: any): thing is ResourceFileEdit {
  return (!!((thing as ResourceFileEdit).newUri) || !!((thing as ResourceFileEdit).oldUri));
}
