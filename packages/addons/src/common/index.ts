import { FileTreeDropEvent } from '@opensumi/ide-core-common';

export const FileDropServicePath = 'FileDropServicePath';

export const IFileDropServiceToken = Symbol('IFileDropService');

export interface IFileDropBackendService {
  ensureFileExist(fileName: string, targetDir: string): Promise<boolean>;
  writeStream(chunk: string | ArrayBuffer, fileName: string, targetDir: string, done: boolean): Promise<void>;
}

export const IFileDropFrontendServiceToken = Symbol('IFileDropFrontendService');
export interface IFileDropFrontendService {
  onDidDropFile(e: FileTreeDropEvent): void;
}

export interface IWebkitDataTransfer {
  items: IWebkitDataTransferItem[];
}

export interface IWebkitDataTransferItem {
  webkitGetAsEntry(): IWebkitDataTransferItemEntry;
}

export interface IWebkitDataTransferItemEntry {
  name: string | undefined;
  fullPath: string;
  isFile: boolean;
  isDirectory: boolean;
  type: string;

  file(resolve: (file: File) => void, reject: () => void): void;
  createReader(): IWebkitDataTransferItemEntryReader;
}

export interface IWebkitDataTransferItemEntryReader {
  readEntries(resolve: (file: IWebkitDataTransferItemEntry[]) => void, reject: () => void): void;
}
