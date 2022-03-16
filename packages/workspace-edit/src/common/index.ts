import {
  Uri,
  URI,
  IRange,
  BasicEvent,
  FileStat,
  CancellationToken,
  WaitUntilEvent,
  IDisposable,
  Event,
} from '@opensumi/ide-core-common';
// eslint-disable-next-line import/no-restricted-paths
import type { EndOfLineSequence } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import type { IBulkEditService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';

// 对文件位置(添加，删除，移动, 复制)
export interface IResourceFileEdit {
  oldResource?: URI;
  newResource?: URI;
  options: {
    overwrite?: boolean;
    ignoreIfNotExists?: boolean;
    ignoreIfExists?: boolean;
    recursive?: boolean;
    showInEditor?: boolean;
    isDirectory?: boolean;
    copy?: boolean;
  };
}

// 对文件内容的编辑
export interface IResourceTextEdit {
  resource: URI;
  versionId?: number; // monaco's version id
  textEdit: ITextEdit;
  options?: {
    openDirtyInEditor?: boolean;
    dirtyIfInEditor?: boolean;
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

export const IWorkspaceFileService = Symbol('IWorkspaceFileService');

// 区分开 monaco 内部的 IBulkEditServiceShape
export const IBulkEditServiceShape = Symbol('IBulkEditServiceShape');
export type IBulkEditServiceShape = IBulkEditService;

export const enum FileOperation {
  CREATE,
  DELETE,
  MOVE,
  COPY,
}

export const FILE_OPERATION_TIMEOUT = 5000;

export interface SourceTargetPair {
  /**
   * The source resource that is defined for move operations.
   */
  readonly source?: Uri;

  /**
   * The target resource the event is about.
   */
  readonly target: Uri;
}

/**
 * not supported yet
 */
export interface IFileOperationUndoRedoInfo {
  /**
   * Id of the undo group that the file operation belongs to.
   */
  undoRedoGroupId?: number;

  /**
   * Flag indicates if the operation is an undo.
   */
  isUndoing?: boolean;
}

export interface IWorkspaceFileOperationParticipant {
  /**
   * Participate in a file operation of working copies. Allows to
   * change the working copies before they are being saved to disk.
   */
  participate(
    files: SourceTargetPair[],
    operation: FileOperation,
    undoInfo: IFileOperationUndoRedoInfo | undefined,
    timeout: number,
    token: CancellationToken,
  ): Promise<void>;
}

export interface WorkspaceFileEvent extends WaitUntilEvent {
  /**
   * An identifier to correlate the operation through the
   * different event types (before, after, error).
   */
  readonly correlationId: number;

  /**
   * The file operation that is taking place.
   */
  readonly operation: FileOperation;

  /**
   * The array of source/target pair of files involved in given operation.
   */
  readonly files: SourceTargetPair[];
}

export interface IWorkspaceFileService {
  readonly onWillRunWorkspaceFileOperation: Event<WorkspaceFileEvent>;
  readonly onDidFailWorkspaceFileOperation: Event<WorkspaceFileEvent>;
  readonly onDidRunWorkspaceFileOperation: Event<WorkspaceFileEvent>;

  create(resource: URI, contents?: string, options?: { overwrite?: boolean }): Promise<FileStat>;
  createFolder(resource: URI): Promise<FileStat>;
  move(files: Required<SourceTargetPair>[], options?: { overwrite?: boolean }): Promise<FileStat[]>;
  copy(files: Required<SourceTargetPair>[], options?: { overwrite?: boolean }): Promise<FileStat[]>;
  delete(resources: URI[], options?: { useTrash?: boolean; recursive?: boolean }): Promise<void>;

  registerFileOperationParticipant(participant: IWorkspaceFileOperationParticipant): IDisposable;
}

export class WorkspaceEditDidRenameFileEvent extends BasicEvent<{ oldUri: URI; newUri: URI }> {}
export class WorkspaceEditDidDeleteFileEvent extends BasicEvent<{ oldUri: URI }> {}
