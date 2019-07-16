import { Event, IDisposable, URI } from '@ali/ide-core-browser';

export const UserStorageService = Symbol('UserStorageService');

export interface UserStorageService extends IDisposable {
  readContents(uri: URI): Promise<string>;

  saveContents(uri: URI, content: string): Promise<void>;

  onUserStorageChanged: Event<UserStorageChangeEvent>;
}

export interface UserStorageChangeEvent {
  uris: URI[];
}
