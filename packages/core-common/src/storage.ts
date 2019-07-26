import { Injectable, Autowired } from '@ali/common-di';
import { Event } from './event';
import { IDisposable } from './disposable';
import { MaybePromise } from './async';
import { ContributionProvider } from './contribution-provider';
import { URI } from './uri'

export const StorageProvider = Symbol('StorageProvider');
export type StorageProvider = (uri: URI) => Promise<Storage>;


export const StorageResolverContribution = Symbol('StorageResolverContribution');

export interface StorageResolverContribution {
  resolve(storageId: string): MaybePromise<Storage>;
}

export interface Storage extends IDisposable {

  readonly items: Map<string, string>;
  readonly size: number;
  readonly onDidChangeStorage: Event<string>;

  init(): Promise<void>;

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

@Injectable()
export class DefaultStorageProvider {

  @Autowired(StorageResolverContribution)
  protected readonly resolversProvider: ContributionProvider<StorageResolverContribution>

  /**
   * 返回对应storageId的Storage类
   */
  async get(storageId: string): Promise<Storage> {
    const resolvers = this.resolversProvider.getContributions();
    for (const resolver of resolvers) {
      try {
        return await resolver.resolve(storageId);
      } catch (err) {
        // no-op
      }
    }
    return Promise.reject(new Error(`A storage provider for '${storageId}' is not registered.`));
  }

}
