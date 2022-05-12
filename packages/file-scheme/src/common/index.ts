import { IEditorDocumentChange, IEditorDocumentModelSaveResult } from '@opensumi/ide-core-common';

export const FILE_ON_DISK_SCHEME = 'fileOnDisk';

export const FILE_SAVE_BY_CHANGE_THRESHOLD = 100000; // 约 100k 大小的脚本

export const IFileSchemeDocClient = Symbol('IFileSchemeDocClient');
export interface IFileSchemeDocClient {
  /**
   * 使用changes进行保存，适用于内容较大的文件
   * @param path
   * @param change
   * @param encoding
   * @param force 强制保存，无视diff
   */
  saveByChange(
    uri: string,
    change: IContentChange,
    encoding?: string,
    force?: boolean,
  ): Promise<IEditorDocumentModelSaveResult>;
  /**
   * 直接使用文件内容进行保存，适用于较小的文件
   * @param path
   * @param content
   * @param encoding
   * @param force 强制保存，无视diff
   */
  saveByContent(
    uri: string,
    content: ISavingContent,
    encoding?: string,
    force?: boolean,
  ): Promise<IEditorDocumentModelSaveResult>;
  getMd5(uri: string, encoding?: string): Promise<string | undefined>;
}

export interface IFileSchemeDocNodeService {
  /**
   * 使用changes进行保存，适用于内容较大的文件
   * @param path
   * @param change
   * @param encoding
   * @param force 强制保存，无视diff
   */
  $saveByChange(
    uri: string,
    change: IContentChange,
    encoding?: string,
    force?: boolean,
  ): Promise<IEditorDocumentModelSaveResult>;

  /**
   * 直接使用文件内容进行保存，适用于较小的文件
   * @param path
   * @param content
   * @param encoding
   * @param force 强制保存，无视diff
   */
  $saveByContent(
    uri: string,
    content: ISavingContent,
    encoding?: string,
    force?: boolean,
  ): Promise<IEditorDocumentModelSaveResult>;

  $getMd5(uri: string, encoding?: string): Promise<string | undefined>;
}

export const IFileSchemeDocNodeService = Symbol('FileSchemeDocNodeService');

export const FileSchemeDocNodeServicePath = 'FileSchemeDocNodeService';

export interface IContentChange {
  baseMd5: string;

  eol: '\n' | '\r\n';

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
