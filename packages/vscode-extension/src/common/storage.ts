export interface KeysToAnyValues { [key: string]: any; }
export interface KeysToKeysToAnyValue { [key: string]: KeysToAnyValues; }

export interface IMainThreadStorage {
  $getValue<T>(shared: boolean, key: string): Promise<T | undefined>;
  $setValue(shared: boolean, key: string, value: object): Promise<void>;
}

export interface IExtHostStorage {
  $acceptValue(shared: boolean, key: string, value: object | undefined): void;
}
