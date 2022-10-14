import { URI, BasicEvent, MaybePromise, IDisposable, Event } from '@opensumi/ide-core-common';

export interface IResourceProvider {
  scheme?: string; // 相当于 handlesUri => 10

  /**
   * 一个 provider 是否处理某个资源
   * 返回优先级，这个值越高的 provider 越优先处理， 小于 0 表示不处理
   * 这个比较的计算结果会被缓存，仅仅当 provider 数量变更时才会清空
   * 存在 handlesURI 时， 上面的scheme会被忽略
   */
  handlesUri?(uri: URI): number;

  provideResource(uri: URI): MaybePromise<IResource>;

  provideResourceSubname?(resource: IResource, groupResources: IResource[]): string | null;

  shouldCloseResource?(resource: IResource, openedResources: IResource[][]): MaybePromise<boolean>;
  /**
   * 只是用来判断一个 resource 是否可以被 Close
   * 与 shouldCloseResource 的区别是，这个方法不会触发真实的 close，你需要手动调用 `close` 方法
   */
  shouldCloseResourceWithoutConfirm?(resource: IResource): MaybePromise<boolean>;

  close?(resource: IResource, saveAction: AskSaveResult): MaybePromise<boolean>;

  onDisposeResource?(resource: IResource): void;
}

export abstract class ResourceService {
  /**
   * 注册一个新的 ResourceProvider 会触发该事件
   */
  readonly onRegisterResourceProvider: Event<IResourceProvider>;
  /**
   * 写在一个 ResourceProvider 会触发该事件
   */
  readonly onUnregisterResourceProvider: Event<IResourceProvider>;
  /**
   * 根据uri获得一个资源信息
   * 如果uri没有对应的resource提供者，则会返回null
   * @param uri
   */
  abstract getResource(uri: URI): Promise<IResource | null>;

  /**
   * 注册一个resource提供方
   * @param provider
   */
  abstract registerResourceProvider(provider: IResourceProvider): IDisposable;

  /**
   * 是否能关闭一个资源
   */
  abstract shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean>;

  /**
   * 与 `shouldCloseResource` 不同的点在于：不弹窗让用户确认
   * 返回 true 说明用户可以之后调用 `close` 方法将其关闭
   */
  abstract shouldCloseResourceWithoutConfirm(resource: IResource): Promise<boolean>;
  close?(resource: IResource, saveAction: AskSaveResult): MaybePromise<boolean>;

  abstract getResourceDecoration(uri: URI): IResourceDecoration;

  abstract getResourceSubname(resource: IResource, groupResources: IResource[]): string | null;

  /**
   * 销毁一个 resource
   * @param resource
   */
  abstract disposeResource(resource: IResource<any>): void;

  /**
   * 是否存在 provider 可以处理某个 uri
   */
  abstract handlesUri(uri: URI): boolean;
}

/**
 * 当资源信息被更新时，期望provider发送这么一个事件，让当前使用资源的服务能及时了解
 */
export class ResourceNeedUpdateEvent extends BasicEvent<URI> {}

export class ResourceDidUpdateEvent extends BasicEvent<URI> {}

export class ResourceRemoveEvent extends BasicEvent<URI> {}

export class ResourceDecorationChangeEvent extends BasicEvent<IResourceDecorationChangeEventPayload> {}

export class ResourceDecorationNeedChangeEvent extends BasicEvent<IResourceDecorationChangeEventPayload> {}

export type IResourceUpdateType = 'change' | 'remove';

export interface IResourceDecoration {
  dirty: boolean;
}

export interface IResourceDecorationChangeEventPayload {
  uri: URI;
  decoration: IResourceDecoration;
}

/**
 * Resource
 * 一个资源代表了一个能够在编辑器区域被打开的东西
 */
export interface IResource<MetaData = any> {
  /**
   * 是否允许刷新后恢复
   */
  supportsRevive?: boolean;

  // 资源名称
  name: string;
  // 资源URI
  uri: URI;
  // 资源icon的class
  icon: string;
  // 资源的额外信息
  metadata?: MetaData;
  // 资源已被删除
  deleted?: any;
}

export type IDiffResource = IResource<{ original: URI; modified: URI }>;

export const DIFF_SCHEME = 'diff';

export function isDiffResource(resource: IResource): resource is IDiffResource {
  return resource.uri.scheme === DIFF_SCHEME;
}

export enum AskSaveResult {
  REVERT = 1,
  SAVE = 2,
  CANCEL = 3,
}
