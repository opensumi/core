import { URI, BasicEvent, MaybePromise, IDisposable } from '@ali/ide-core-common';

export interface IResourceProvider {

  scheme: string;

  provideResource(uri: URI): MaybePromise<IResource>;

  provideResourceSubname?(resource: IResource, groupResources: IResource[]): string | null;

  shouldCloseResource?(resource: IResource, openedResources: IResource[][]): MaybePromise<boolean>;

}

export abstract class ResourceService {

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

  abstract getResourceDecoration(uri: URI): IResourceDecoration;

  abstract getResourceSubname(resource: IResource, groupResources: IResource[]): string | null;

}

/**
 * 当资源信息被更新时，期望provider发送这么一个事件，让当前使用资源的服务能及时了解
 */
export class ResourceNeedUpdateEvent extends BasicEvent<URI> {}

export class ResourceDidUpdateEvent extends BasicEvent<URI> {}

export class ResourceRemoveEvent extends BasicEvent<URI> {}

export class ResourceDecorationChangeEvent extends BasicEvent<IResourceDecorationChangeEventPayload> {}

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
  // 资源名称
  name: string;
  // 资源URI
  uri: URI;
  // 资源icon的class
  icon: string;
  // 资源的额外信息
  metadata?: MetaData;

}

export type IDiffResource  = IResource<{ original: URI, modified: URI }>;
