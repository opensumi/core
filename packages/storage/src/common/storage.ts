import { Event } from '@ide-framework/ide-core-common';

export interface IUpdateRequest {
  insert?: StringKeyToAnyValue;
  delete?: string[];
}

export interface IStorageItemsChangeEvent {
  items: Map<string, string>;
}

export const IWorkspaceStorageServer = 'IWorkspaceStorageServer';
export const IGlobalStorageServer = 'IGlobalStorageServer';

export interface StringKeyToAnyValue {
  [key: string]: any;
}

export interface IStorageServer {
  init(storageDirName?: string, workspace?: string): Promise<string | undefined>;

  getItems(storageName: string): Promise<StringKeyToAnyValue>;
  updateItems(storageName: string, request: IUpdateRequest): Promise<void>;

  close(recovery?: () => Map<string, string>): Promise<void>;

  onDidChange: Event<StorageChange>;
}

export interface StorageChange {
  path: string;
  data: string;
}
