
import { Event, IDisposable, URI } from '@ali/ide-core-browser';

export const IUserStorageService = Symbol('IUserStorageService');

export interface IUserStorageService extends IDisposable {
  readContents(uri: URI): Promise<string>;

  saveContents(uri: URI, content: string): Promise<void>;

  getFsPath(uri: URI): Promise<string | undefined>;

  onUserStorageChanged: Event<UserStorageChangeEvent>;

  whenReady: Promise<void>;
}

export interface UserStorageChangeEvent {
  uris: URI[];
}

export const USER_STORAGE_SCHEME = 'user_storage';
