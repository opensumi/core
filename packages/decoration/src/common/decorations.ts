import { Disposable, Uri, Event, CancellationToken, IDisposable } from '@ali/ide-core-common';

type ColorIdentifier = string;

export interface IDecorationData {
  /**
   * 权重
   */
  readonly weight?: number;
  /**
   * Decoration 颜色
   */
  readonly color?: ColorIdentifier;
  /**
   * Decoration 字符
   */
  readonly letter?: string;
  /**
   * Decoration tooltip
   */
  readonly tooltip?: string;
  /**
   * Decoration 是否冒泡，类似文件的 Decoration 是否传给文件夹
   */
  readonly bubble?: boolean;
  /**
   * @deprecated
   * hacky... we should remove it and use equality under the hood
   */
  readonly source?: string;
}

export interface IDecorationsProvider {
  readonly label: string;
  readonly onDidChange: Event<Uri[]>;
  provideDecorations(uri: Uri, token: CancellationToken): IDecorationData | Promise<IDecorationData | undefined> | undefined;
}

export interface IResourceDecorationChangeEvent {
  affectsResource(uri: Uri): boolean;
}

export interface IDecoration {
  key: string;
  badge: string;
  tooltip: string;
  color?: string; // color id
}

export abstract class IDecorationsService extends Disposable {
  /**
   * 分发 Decoration Change Event
   */
  readonly onDidChangeDecorations: Event<IResourceDecorationChangeEvent>;

  /**
   * 注册 Decoration Provider
   */
  abstract registerDecorationsProvider(provider: IDecorationsProvider): IDisposable;

  /**
   * 通过传入 Uri 和选型获取 Decoration
   */
  abstract getDecoration(uri: Uri, includeChildren: boolean, overwrite?: IDecorationData): IDecoration | undefined;
}
