export interface IMainThreadSecret {
  $getPassword(extensionId: string, key: string): Promise<string | undefined>;
  $setPassword(extensionId: string, key: string, value: string): Promise<void>;
  $deletePassword(extensionId: string, key: string): Promise<void>;
}

export interface IExtHostSecret {
  $onDidChangePassword(e: { extensionId: string, key: string }): Promise<void>;
}
