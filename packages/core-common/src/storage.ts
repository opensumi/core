import { Injectable, Autowired } from '@ali/common-di';
import { Event } from './event';
import { IDisposable } from './disposable';
import { MaybePromise } from './async';
import { URI } from './uri';
import { ContributionProvider } from './contribution-provider';

export const StorageProvider = Symbol('StorageProvider');
export type StorageProvider = (storageId: URI) => Promise<IStorage>;


export const StorageResolverContribution = Symbol('StorageResolverContribution');

export interface StorageResolverContribution {
  resolve(storageId: URI): MaybePromise<void | IStorage>;
}

export interface IStorage extends IDisposable {

  readonly items: Map<string, string>;
  readonly size: number;
  readonly onDidChangeStorage: Event<string>;
  readonly whenReady: Promise<any>;

  init(storageId: string): Promise< IStorage | void >;

  get(key: string, fallbackValue: string): string;
  get(key: string, fallbackValue?: string): string | undefined;

  getBoolean(key: string, fallbackValue: boolean): boolean;
  getBoolean(key: string, fallbackValue?: boolean): boolean | undefined;

  getNumber(key: string, fallbackValue: number): number;
  getNumber(key: string, fallbackValue?: number): number | undefined;

  set(key: string, value: string | boolean | number | undefined | null): Promise<void>;
  delete(key: string): Promise<void>;

  close(): Promise<void>;
}

export const STORAGE_NAMESPACE = {
  GLOBAL: new URI('db://global'),
  WORKBEACH: new URI('db://worbeach'),
  EXTENSIONS: new URI('db://extensions'),
  // 可添加其他存储模块
}

@Injectable()
export class DefaultStorageProvider {

  @Autowired(StorageResolverContribution)
  protected readonly resolversProvider: ContributionProvider<StorageResolverContribution>

  /**
   * 返回对应storageId的Storage类
   */
  async get(storageId: URI): Promise<IStorage> {
    const resolvers = this.resolversProvider.getContributions();
    for (const resolver of resolvers) {
      const storageResolver = await resolver.resolve(storageId);
      if (storageResolver) {
        return Promise.resolve(storageResolver);
      }
    }
    return Promise.reject(new Error(`A storage provider for '${storageId}' is not registered.`));
  }

}
