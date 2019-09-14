import { URI, IRange, BasicEvent } from '@ali/ide-core-common';
import { EndOfLineSequence } from '@ali/ide-editor';

// 对文件位置(添加，删除，移动)
export interface IResourceFileEdit {
  oldUri?: URI;
  newUri?: URI;
  options: {
    overwrite?: boolean,
    ignoreIfNotExists?: boolean,
    ignoreIfExists?: boolean;
    recursive?: boolean,
    showInEditor?: boolean,
  };
}

// 对文件内容的编辑
export interface IResourceTextEdit {
  resource: URI;
  modelVersionId?: number; // monaco's version id
  edits: ITextEdit[];
  options?: {
    openDirtyInEditor?: boolean
    dirtyIfInEditor?: boolean,
  };
}

export interface ITextEdit {
  range: IRange;
  text: string;
  eol?: EndOfLineSequence;
}

export interface IWorkspaceEdit {
  edits: Array<IResourceFileEdit | IResourceTextEdit>;
}

export const IWorkspaceEditService = Symbol('IWorkspaceEditService');

export interface IWorkspaceEditService {

  apply(edit: IWorkspaceEdit): Promise<void>;

  // 回复最上层的文件变更
  revertTopFileEdit(): Promise<void>;

}

export class WorkspaceEditDidRenameFileEvent extends BasicEvent<{oldUri: URI, newUri: URI}> {}
