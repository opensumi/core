import { Event, IBaseMarkerService, IMarker } from '@ali/ide-core-common';
import { IMatch } from '@ali/ide-core-common/lib/filters';

export interface IMarkerService extends IBaseMarkerService {
  /**
   * 获取当前所有的marker来源uri
   */
  getResources(): string[];

  /**
   * filter内容变化时触发事件
   */
  onMarkerFilterChanged: Event<IFilterOptions | undefined>;
}

/**
 * marker 过滤条件
 */
// tslint:disable-next-line: no-empty-interface
export interface IFilterOptions { }

export type RenderableMarker = IFilterMarker | IMarker;

/**
 * 过滤后的marker
 */
export interface IFilterMarker extends IMarker {
  match: boolean;
  matches?: IFilterMatches;
}

/**
 * marker item构建器，防止在其他地方散乱的构建代码
 */
export class MarkerItemBuilder {
  public static buildFilterItem(marker: IMarker, match: boolean, matches?: IFilterMatches): IFilterMarker {
    return {
      ...marker,
      match,
      matches,
    };
  }
}

/**
 * filter detail postions
 */
export interface IFilterMatches {
  filenameMatches?: IMatch[] | undefined | null; // 文件名称
  messageMatches?: IMatch[] | undefined | null; // 信息
  sourceMatches?: IMatch[] | undefined | null; // 来源
  codeMatches?: IMatch[] | undefined | null; // 错误编码
}

// 可渲染marker model
export type RenderableMarkerModel = IFilterMarkerModel | IMarkerModel;

export interface IMarkerModelLike <T extends IMarker> {
  readonly resource: string;
  readonly icon: string;
  readonly filename: string;
  readonly longname: string;
  readonly markers: T[];
  size: () => number;
}

export interface IMarkerModel extends IMarkerModelLike<IMarker> {}

export interface IFilterMarkerModel extends IMarkerModelLike<IFilterMarker> {
  readonly match: boolean;
  readonly matches?: IFilterMatches;
}

export class MarkerModelBuilder {
  public static buildModel(resource: string, icon: string, filename: string, longname: string, markers: RenderableMarker[]): IMarkerModel {
    return {
      resource,
      icon,
      filename,
      longname,
      markers,
      size: () => markers.length,
    };
  }

  public static buildFilterModel(model: IMarkerModel, markers: IFilterMarker[], match: boolean, matches): IFilterMarkerModel {
    return {
      ...model,
      match,
      markers,
      matches,
      size: () => {
        let count = 0;
        markers.forEach((m) => {
          if (m.match) { count++; }
        });
        return count;
      },
    };
  }
}
