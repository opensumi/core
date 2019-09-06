import { IEditorDocumentChange, IEditorDocumentModelSaveResult } from '@ali/ide-core-common';

export const FILE_SCHEME = 'file';
export const FILE_ON_DISK_SCHEME = 'fileOnDisk';

export const FILE_SAVE_BY_CHANGE_THRESHOLD = 1000000; // 约1M大小的脚本

export interface IFileSchemeDocNodeService {

  /**
   * 使用changes进行保存，适用于内容较大的文件
   * @param path
   * @param change
   * @param encoding
   */
  $saveByChange(uri: string, change: IContentChange, encoding?: string): Promise<IEditorDocumentModelSaveResult>;

  /**
   * 直接使用文件内容进行保存，适用于较小的文件
   * @param path
   * @param content
   * @param encoding
   */
  $saveByContent(uri: string, content: ISavingContent, encoding?: string): Promise<IEditorDocumentModelSaveResult>;

  $getMd5(uri: string, encoding?: string): Promise<string | undefined>;
}

export const IFileSchemeDocNodeService = Symbol('FileSchemeDocNodeService');

export const FileSchemeDocNodeServicePath = 'FileSchemeDocNodeService';

export interface IContentChange {

  baseMd5: string;

  changes?: IEditorDocumentChange[]; // 通过monaco编辑行为跟踪而来

  rawChanges?: ISingleChange[]; // 通过jsdiff比较得来
}

export interface ISavingContent {

  baseMd5: string;

  content: string;

}

export interface ISingleChange {

  offset: number;

  length: number;

  text: string;

  type: ChangeType;

}

export enum ChangeType {

  ADDED = 1,

  REMOVED = 2,

}
