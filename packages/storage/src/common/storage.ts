export interface IUpdateRequest {
  insert?: StringKeyToAnyValue;
  delete?: string[];
}

export interface IStorageItemsChangeEvent {
  items: Map<string, string>;
}

export const IDatabaseStorageServer = 'IDatabaseStorageServer';

export const DatabaseStorageServerPath = 'DatabaseStorageServerPath';

export interface StringKeyToAnyValue {
  [key: string]: any;
}

export interface IDatabaseStorageServer {
  init(storageName: string): Promise<string | undefined>;

  getItems(): Promise<StringKeyToAnyValue>;
  updateItems(request: IUpdateRequest): Promise<void>;

  close(recovery?: () => Map<string, string>): Promise<void>;
}
