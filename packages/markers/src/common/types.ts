import { Event, IBaseMarkerService, IMarker } from '@ali/ide-core-common';
import { IMatch } from '@ali/ide-core-common/lib/filters';

/**
 * marker 服务
 */
export interface IMarkerService extends IBaseMarkerService {
  /**
   * 获取当前所有的resources
   */
  getResources(): string[];

  /**
   * filter options changed event
   */
  onMarkerFilterChanged: Event<IFilterOptions | undefined>;
}

/**
 * marker 过滤条件
 */
export abstract class IFilterOptions {
}

/**
 * 匹配信息
 */
export interface IFilterMatches {
  filenameMatches?: IMatch[] | undefined | null; // 文件名称
  messageMatches?: IMatch[] | undefined | null; // 信息
  sourceMatches?: IMatch[] | undefined | null; // 来源
  codeMatches?: IMatch[] | undefined | null; // 错误编码
}

export interface IFilterMarkerItem extends IMarker {
  match: boolean;
  matches?: IFilterMatches;
}

/**
 * 可以展示的Marker
 */
export interface IMarkerModel {
  readonly uri: string;
  readonly icon: string;
  readonly filename: string;
  readonly longname: string;
  readonly markers: IFilterMarkerItem[];

  readonly matches?: IFilterMatches;

  size: () => number;
}
