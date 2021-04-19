import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { IResourceTextEdit, IWorkspaceEditService, IWorkspaceEdit, IResourceFileEdit, WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent, IWorkspaceFileService } from '../common';
import { URI, IEventBus, isWindows, isUndefined } from '@ali/ide-core-browser';
import { FileSystemError } from '@ali/ide-file-service/lib/common';
import { Injectable, Autowired } from '@ali/common-di';
import { EndOfLineSequence, WorkbenchEditorService, EOL } from '@ali/ide-editor';
import { runInAction } from 'mobx';
import { IEditorDocumentModelService, IResource, isDiffResource } from '@ali/ide-editor/lib/browser';
import { EditorGroup } from '@ali/ide-editor/lib/browser/workbench-editor.service';
import { Range } from '@ali/monaco-editor-core/esm/vs/editor/common/core/range';

type WorkspaceEdit = ResourceTextEditTask | ResourceFileEdit;

@Injectable()
export class WorkspaceEditServiceImpl implements IWorkspaceEditService {

  private editStack: BulkEdit[] = [];

  @Autowired(IEditorDocumentModelService)
  documentModelService: IEditorDocumentModelService;

  @Autowired(IWorkspaceFileService)
  workspaceFileService: IWorkspaceFileService;

  @Autowired()
  editorService: WorkbenchEditorService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  async apply(edit: IWorkspaceEdit): Promise<void> {
    const bulkEdit = new BulkEdit();
    edit.edits.forEach((edit) => {
      bulkEdit.add(edit);
    });
    await bulkEdit.apply(this.documentModelService, this.workspaceFileService, this.editorService, this.eventBus);
    this.editStack.push(bulkEdit);
  }

  revertTopFileEdit(): Promise<void> {
    // TODO
    throw new Error('Method not implemented.');
  }

}

export class BulkEdit {

  private edits: WorkspaceEdit[] = [];

  async apply(documentModelService: IEditorDocumentModelService, fileSystemService: IWorkspaceFileService, editorService: WorkbenchEditorService, eventBus: IEventBus) {
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
            if (textEdit.modelVersionId) {
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
            last.addEdit(edit as IResourceTextEdit);
            return;
          }
        }
      }
      this.edits.push(new ResourceTextEditTask(edit as IResourceTextEdit));
    }
  }

  revert(onlyFileEdits: true) {
    // TODO
  }

}

export class ResourceTextEditTask {

  public edits: IResourceTextEdit[];
  public resource: URI;
  public modelVersionId: number | undefined;
  public options: {
    openDirtyInEditor?: boolean
    dirtyIfInEditor?: boolean,
  } = {};

  constructor(edit: IResourceTextEdit) {
    this.resource = edit.resource;
    this.modelVersionId = edit.modelVersionId;
    this.options = edit.options || {};
    this.edits = [ edit ];
  }

  addEdit(edit: IResourceTextEdit) {
    this.edits.push(edit);
  }

  async apply(documentModelService: IEditorDocumentModelService, editorService: WorkbenchEditorService) {
    const docRef = await documentModelService.createModelReference(this.resource, 'bulk-edit');
    const documentModel = docRef.instance;
    const monacoModel = documentModel.getMonacoModel();
    if (this.modelVersionId) {
      if (monacoModel.getVersionId() !== this.modelVersionId) {
        throw new Error('文档版本不一致，无法执行变更');
      }
    }
    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    let newEOL: EndOfLineSequence | null = null;
    for (const edit of this.edits) {
      if (!isUndefined(edit.edit.eol)) {
        newEOL = edit.edit.eol;
      }
      edits.push({
        forceMoveMarkers: true,
        range: Range.lift(edit.edit.range),
        text: edit.edit.text,
      });
    }

    if (edits.length > 0) {
      monacoModel.pushStackElement();
      monacoModel.pushEditOperations([], edits, () => []);
      monacoModel.pushStackElement();
    }

    if (!isUndefined(newEOL)) {
      monacoModel.pushStackElement();
      documentModel.eol = newEOL === EndOfLineSequence.CRLF ? EOL.CRLF : EOL.LF;
      monacoModel.pushStackElement();
    }
    const shouldSave = await this.editorOperation(editorService);
    if (shouldSave) {
      documentModel.save();
    }
    docRef.dispose();
  }

  // 返回是否保存
  private async editorOperation(editorService: WorkbenchEditorService): Promise<boolean> {
    if (this.options.openDirtyInEditor) {
      for (const group of editorService.editorGroups) {
        if (group.resources.findIndex((r) => isDocumentUriInResource(r, this.resource)) !== -1) {
          return false;
        }
      }
      editorService.open(this.resource, { backend: true });
      return false;
    } else if (this.options.dirtyIfInEditor) {
      for (const group of editorService.editorGroups) {
        if (group.resources.findIndex((r) => isDocumentUriInResource(r, this.resource)) !== -1) {
          return false;
        }
      }
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
    recursive?: boolean | undefined;
    showInEditor?: boolean;
    isDirectory?: boolean;
    copy?: boolean;
    ignoreIfExists?: boolean | undefined;
  } = {};

  constructor(edit: IResourceFileEdit) {
    this.oldUri = edit.oldUri;
    this.newUri = edit.newUri;
    this.options = edit.options;
  }

  async notifyEditor(editorService: WorkbenchEditorService, documentModelService: IEditorDocumentModelService) {
    if (this.oldUri && this.newUri) {
      const promises: Promise<any>[] = [];
      const urisToDealWith: Set<string> = new Set();
      editorService.editorGroups.forEach((g) => {
        g.resources.forEach((r) => {
          if (this.oldUri!.isEqualOrParent(r.uri)) {
            urisToDealWith.add(r.uri.toString());
          }
        });
      });
      urisToDealWith.forEach((uriString) => {
        const oldUri = new URI(uriString);
        const subPath = uriString.substr(this.oldUri!.toString().length);
        const newUri = new URI(this.newUri!.toString()! + subPath);
        promises.push(this.notifyOnResource(oldUri, newUri, editorService, documentModelService));
      });
      return Promise.all(promises);
    }
  }

  async notifyOnResource(oldUri: URI, newUri: URI, editorService: WorkbenchEditorService, documentModelService: IEditorDocumentModelService) {
    const docRef = documentModelService.getModelReference(oldUri, 'bulk-file-move');
    let dirtyContent: string | undefined;
    let dirtyEOL: EOL | undefined;
    if (docRef && docRef.instance.dirty) {
      dirtyContent = docRef.instance.getText();
      dirtyEOL = docRef.instance.eol;
      await docRef.instance.revert(true);
    }
    if (docRef) {
      docRef.dispose();
    }
    // 如果之前的文件在编辑器中被打开，重新打开文件
    await Promise.all([editorService.editorGroups.map(async (g) => {
      const index = g.resources.findIndex((r) => r.uri.isEqual(oldUri));
      if (index !== -1) {
        await runInAction(async () => {
          await g.open(newUri, {
            index,
            backend: !(g.currentResource && g.currentResource.uri.isEqual(oldUri)),
            // 如果旧的是preview模式，应该保持，如果不是，应该不要关闭其他处于preview模式的资源tab
            preview: (g as EditorGroup).previewURI ? (g as EditorGroup).previewURI!.isEqual(oldUri) : false,
          });
          await g.close(oldUri);
        });
      }
    })]);

    if (dirtyContent) {
      const newDocRef = await documentModelService.createModelReference(newUri, 'bulk-file-move');
      newDocRef.instance.updateContent(dirtyContent, dirtyEOL);
      newDocRef.dispose();
    }
  }

  async apply(editorService: WorkbenchEditorService, fileServiceClient: IWorkspaceFileService, documentModelService: IEditorDocumentModelService, eventBus: IEventBus) {
    const options = this.options || {};

    if (this.newUri && this.oldUri) {

      if (options.copy) {
        await fileServiceClient.copy([{ source: this.oldUri.codeUri, target: this.newUri.codeUri}], options);

      } else {
        // rename
        await fileServiceClient.move([{ source: this.oldUri.codeUri, target: this.newUri.codeUri}], options);

        await this.notifyEditor(editorService, documentModelService);

        // TODO 文件夹rename应该带传染性, 但是遍历实现比较坑，先不实现
        eventBus.fire(new WorkspaceEditDidRenameFileEvent({ oldUri: this.oldUri, newUri: this.newUri }));
      }

      if (options.showInEditor) {
        editorService.open(this.newUri);
      }

    } else if (!this.newUri && this.oldUri) {
      // 删除文件
      try {
        // electron windows下moveToTrash大量文件会导致IDE卡死，如果检测到这个情况就不使用moveToTrash
        await fileServiceClient.delete([this.oldUri], { useTrash: !(isWindows && this.oldUri.path.name === 'node_modules') });
        // 默认recursive
        await editorService.close(this.oldUri, true);
        eventBus.fire(new WorkspaceEditDidDeleteFileEvent({ oldUri: this.oldUri}));
      } catch (err) {
        if (FileSystemError.FileNotFound.is(err) && options.ignoreIfNotExists) {
          // 不抛出错误
        } else {
          throw err;
        }
      }
    } else if (this.newUri && !this.oldUri) {
      // 创建文件
      try {
        if (options.isDirectory) {
          await fileServiceClient.createFolder(this.newUri);
        } else {
          await fileServiceClient.create(this.newUri, '', { overwrite: options.overwrite });
        }
      } catch (err) {
        if (FileSystemError.FileExists.is(err) && options.ignoreIfExists) {
          // 不抛出错误
        } else {
          throw err;
        }
      }
      if (!options.isDirectory && options.showInEditor) {
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

/**
 * 当前编辑器的文档是否在指定的编辑器 resource (tab) 中
 * 此处需要额外判断一下 diffEditor 的情况
 * @param resource
 * @param uri
 */
function isDocumentUriInResource(resource: IResource<any>, uri: URI) {
  if (isDiffResource(resource)) {
    return resource.metadata?.modified.isEqual(uri) || resource.metadata?.original.isEqual(uri);
  } else {
    return resource.uri.isEqual(uri);
  }
}
