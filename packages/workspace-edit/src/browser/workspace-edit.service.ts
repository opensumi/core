import { runInAction } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { URI, IEventBus, isWindows, isUndefined } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService, IResource, isDiffResource } from '@opensumi/ide-editor/lib/browser';
import { EditorGroup } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { FileSystemError } from '@opensumi/ide-file-service/lib/common';
import { EndOfLineSequence, EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  IResourceTextEdit,
  IWorkspaceEditService,
  IWorkspaceEdit,
  IResourceFileEdit,
  WorkspaceEditDidRenameFileEvent,
  WorkspaceEditDidDeleteFileEvent,
  IWorkspaceFileService,
} from '../common';

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
    await bulkEdit.apply(this.documentModelService, this.editorService, this.workspaceFileService, this.eventBus);
    this.editStack.push(bulkEdit);
  }

  revertTopFileEdit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export class BulkEdit {
  private edits: WorkspaceEdit[] = [];

  async apply(
    documentModelService: IEditorDocumentModelService,
    editorService: WorkbenchEditorService,
    workspaceFS: IWorkspaceFileService,
    eventBus: IEventBus,
  ) {
    for (const edit of this.edits) {
      if (edit instanceof ResourceFileEdit) {
        await edit.apply(documentModelService, editorService, workspaceFS, eventBus);
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
          if (last.versionId) {
            if (textEdit.versionId) {
              shouldMerge = textEdit.versionId === last.versionId;
            } else {
              shouldMerge = true;
            }
          } else {
            if (!textEdit.versionId) {
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

  revert(onlyFileEdits: true) {}
}

export class ResourceTextEditTask {
  public edits: IResourceTextEdit[];
  public resource: URI;
  public versionId: number | undefined;
  public options: {
    openDirtyInEditor?: boolean;
    dirtyIfInEditor?: boolean;
  } = {};

  constructor(edit: IResourceTextEdit) {
    this.resource = edit.resource;
    this.versionId = edit.versionId;
    this.options = edit.options || {};
    this.edits = [edit];
  }

  addEdit(edit: IResourceTextEdit) {
    this.edits.push(edit);
  }

  async apply(documentModelService: IEditorDocumentModelService, editorService: WorkbenchEditorService) {
    const docRef = await documentModelService.createModelReference(this.resource, 'bulk-edit');
    const documentModel = docRef.instance;
    const monacoModel = documentModel.getMonacoModel();
    if (this.versionId) {
      if (monacoModel.getVersionId() !== this.versionId) {
        throw new Error('文档版本不一致，无法执行变更');
      }
    }
    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    let newEOL: EndOfLineSequence | undefined;
    for (const edit of this.edits) {
      if (edit.textEdit.eol && !isUndefined(edit.textEdit.eol)) {
        newEOL = edit.textEdit.eol;
      }
      edits.push({
        forceMoveMarkers: true,
        range: Range.lift(edit.textEdit.range),
        text: edit.textEdit.text,
      });
    }

    if (edits.length > 0) {
      monacoModel.pushStackElement();
      monacoModel.pushEditOperations([], edits, () => []);
      monacoModel.pushStackElement();
    }

    if (newEOL && !isUndefined(newEOL)) {
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

  async revert(): Promise<void> {}
}

export class ResourceFileEdit implements IResourceFileEdit {
  oldResource?: URI;
  newResource?: URI;
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
    this.oldResource = edit.oldResource;
    this.newResource = edit.newResource;
    this.options = edit.options;
  }

  async notifyEditor(editorService: WorkbenchEditorService, documentModelService: IEditorDocumentModelService) {
    if (this.oldResource && this.newResource) {
      const promises: Promise<any>[] = [];
      const urisToDealWith: Set<string> = new Set();
      editorService.editorGroups.forEach((g) => {
        g.resources.forEach((r) => {
          if (this.oldResource!.isEqualOrParent(r.uri)) {
            urisToDealWith.add(r.uri.toString());
          }
        });
      });
      urisToDealWith.forEach((uriString) => {
        const oldResource = new URI(uriString);
        const subPath = uriString.substr(this.oldResource!.toString().length);
        const newResource = new URI(this.newResource!.toString()! + subPath);
        promises.push(this.notifyOnResource(oldResource, newResource, editorService, documentModelService));
      });
      return Promise.all(promises);
    }
  }

  async notifyOnResource(
    oldResource: URI,
    newResource: URI,
    editorService: WorkbenchEditorService,
    documentModelService: IEditorDocumentModelService,
  ) {
    const docRef = documentModelService.getModelReference(oldResource, 'bulk-file-move');
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
    await Promise.all([
      editorService.editorGroups.map(async (g) => {
        const index = g.resources.findIndex((r) => r.uri.isEqual(oldResource));
        if (index !== -1) {
          await runInAction(async () => {
            await g.open(newResource, {
              index,
              backend: !(g.currentResource && g.currentResource.uri.isEqual(oldResource)),
              // 如果旧的是preview模式，应该保持，如果不是，应该不要关闭其他处于preview模式的资源tab
              preview: (g as EditorGroup).previewURI ? (g as EditorGroup).previewURI!.isEqual(oldResource) : false,
            });
            await g.close(oldResource);
          });
        }
      }),
    ]);

    if (dirtyContent) {
      const newDocRef = await documentModelService.createModelReference(newResource, 'bulk-file-move');
      newDocRef.instance.updateContent(dirtyContent, dirtyEOL);
      newDocRef.dispose();
    }
  }

  async apply(
    documentModelService: IEditorDocumentModelService,
    editorService: WorkbenchEditorService,
    workspaceFS: IWorkspaceFileService,
    eventBus: IEventBus,
  ) {
    const options = this.options || {};

    if (this.newResource && this.oldResource) {
      if (options.copy) {
        await workspaceFS.copy([{ source: this.oldResource.codeUri, target: this.newResource.codeUri }], options);
      } else {
        // rename
        await workspaceFS.move([{ source: this.oldResource.codeUri, target: this.newResource.codeUri }], options);

        await this.notifyEditor(editorService, documentModelService);

        // TODO: 文件夹rename应该带传染性, 但是遍历实现比较坑，先不实现
        eventBus.fire(new WorkspaceEditDidRenameFileEvent({ oldUri: this.oldResource, newUri: this.newResource }));
      }

      if (options.showInEditor) {
        editorService.open(this.newResource);
      }
    } else if (!this.newResource && this.oldResource) {
      // 删除文件
      try {
        // electron windows下moveToTrash大量文件会导致IDE卡死，如果检测到这个情况就不使用moveToTrash
        await workspaceFS.delete([this.oldResource], {
          useTrash: !(isWindows && this.oldResource.path.name === 'node_modules'),
        });
        // 默认recursive
        await editorService.close(this.oldResource, true);
        eventBus.fire(new WorkspaceEditDidDeleteFileEvent({ oldUri: this.oldResource }));
      } catch (err) {
        if (FileSystemError.FileNotFound.is(err) && options.ignoreIfNotExists) {
          // 不抛出错误
        } else {
          throw err;
        }
      }
    } else if (this.newResource && !this.oldResource) {
      // 创建文件
      try {
        if (options.isDirectory) {
          await workspaceFS.createFolder(this.newResource);
        } else {
          await workspaceFS.create(this.newResource, '', { overwrite: options.overwrite });
        }
      } catch (err) {
        // FIXME: 不知道为什么这里错误不是 FileSystemError 了，所以换个实现兼容一下
        if (this.isFileExistError(err) && options.ignoreIfExists) {
          // 不抛出错误
        } else {
          throw err;
        }
      }
      if (!options.isDirectory && options.showInEditor) {
        editorService.open(this.newResource);
      }
    }
  }

  private isFileExistError(err: Error): boolean {
    return err.message.includes('already exists.');
  }

  async revert(): Promise<void> {}
}

export function isResourceFileEdit(thing: any): thing is ResourceFileEdit {
  return !!(thing as ResourceFileEdit).newResource || !!(thing as ResourceFileEdit).oldResource;
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
