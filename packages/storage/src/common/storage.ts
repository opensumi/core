export interface IUpdateRequest {
  insert?: StringKeyToAnyValue;
  delete?: string[];
}

export interface IStorageItemsChangeEvent {
  items: Map<string, string>;
}

export const IWorkspaceStorageServer = 'IWorkspaceStorageServer';
export const IGlobalStorageServer = 'IGlobalStorageServer';

export const WorkspaceStorageServerPath = 'WorkspaceStorageServerPath';
export const GlobalStorageServerPath = 'GlobalStorageServerPath';

export interface StringKeyToAnyValue {
  [key: string]: any;
}

export interface IStorageServer {
  init(workspace?: string): Promise<string | undefined>;

  getItems(storageName: string): Promise<StringKeyToAnyValue>;
  updateItems(storageName: string, request: IUpdateRequest): Promise<void>;

  close(recovery?: () => Map<string, string>): Promise<void>;
}
