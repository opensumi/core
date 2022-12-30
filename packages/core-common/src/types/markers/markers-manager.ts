import { Injectable } from '@opensumi/di';
import { Emitter, Event, IDisposable, arrays } from '@opensumi/ide-utils';

import { WithEventBus } from '../../event-bus';

import { MapMap } from './markers';
import { IMarker, IMarkerData, MarkerStatistics, MarkerSeverity } from './markers';

const { isFalsyOrEmpty } = arrays;

export interface IBaseMarkerManager {
  /**
   * 更新markers
   * @param type 类型标识
   * @param uri markers对应的资源
   * @param markers 所有markers
   */
  updateMarkers(type: string, uri: string, markers: IMarkerData[]);

  /**
   * 清空markers
   * @param type 类型标识
   */
  clearMarkers(type: string);

  /**
   * 获取所有markers的统计信息
   */
  getStats(): MarkerStats;

  /**
   * 获得当前所有资源
   */
  getResources(): string[];

  /**
   * 获取markers
   */
  getMarkers(filter: {
    type?: string;
    resource?: string;
    severities?: number;
    take?: number;
    opened?: boolean;
  }): IMarker[];

  /**
   * marker变更事件
   */
  onMarkerChanged: Event<string[]>;

  /**
   * 打开编辑器回调
   * @param resource 资源
   */
  onEditorGroupOpen(resource: string);

  /**
   * 关闭编辑器回调
   * @param resource 资源
   */
  onEditorGroupClose(resource: string);
}

export class MarkerStats implements MarkerStatistics, IDisposable {
  public errors = 0;
  public infos = 0;
  public warnings = 0;
  public unknowns = 0;

  private _data?: { [resource: string]: MarkerStatistics } = Object.create(null);
  private _manager: IBaseMarkerManager;
  private _subscription: IDisposable;

  constructor(manager: IBaseMarkerManager) {
    this._manager = manager;
    this._subscription = manager.onMarkerChanged(this._update, this);
  }

  dispose(): void {
    this._subscription.dispose();
    this._data = undefined;
  }

  private _update(resources: string[]): void {
    if (!this._data) {
      return;
    }

    for (const resource of resources) {
      const key = resource.toString();
      const oldStats = this._data[key];
      if (oldStats) {
        this._substract(oldStats);
      }
      const newStats = this._resourceStats(resource);
      this._add(newStats);
      this._data[key] = newStats;
    }
  }

  private _resourceStats(resource: string): MarkerStatistics {
    const result: MarkerStatistics = { errors: 0, warnings: 0, infos: 0, unknowns: 0 };

    const markers = this._manager.getMarkers({ resource, opened: true });
    for (const { severity } of markers) {
      if (severity === MarkerSeverity.Error) {
        result.errors += 1;
      } else if (severity === MarkerSeverity.Warning) {
        result.warnings += 1;
      } else if (severity === MarkerSeverity.Info) {
        result.infos += 1;
      } else {
        // Hint
        result.unknowns += 1;
      }
    }

    return result;
  }

  private _substract(op: MarkerStatistics) {
    this.errors -= op.errors;
    this.warnings -= op.warnings;
    this.infos -= op.infos;
    this.unknowns -= op.unknowns;
  }

  private _add(op: MarkerStatistics) {
    this.errors += op.errors;
    this.warnings += op.warnings;
    this.infos += op.infos;
    this.unknowns += op.unknowns;
  }
}

@Injectable()
export class MarkerManager extends WithEventBus implements IBaseMarkerManager {
  // 所有Marker
  private readonly _byResource: MapMap<IMarker[]> = Object.create(null);
  private readonly _byType: MapMap<IMarker[]> = Object.create(null);

  private readonly _byResourceCloseCache: MapMap<IMarker[]> = Object.create(null);

  private readonly _openedResource: Set<string> = new Set();

  // marker 当前状态
  private _stats: MarkerStats;

  // marker 变更 事件
  private readonly onMarkerChangedEmitter = new Emitter<string[]>();
  public readonly onMarkerChanged: Event<string[]> = this.onMarkerChangedEmitter.event;

  constructor() {
    super();
    this.addDispose([(this._stats = new MarkerStats(this)), this.onMarkerChangedEmitter]);
  }

  /**
   * 接受Diagnostics信息，更新marker
   * @param type marker 类型，比如 typescript, eslint等
   * @param uri marker 资源
   * @param rawMarkers 来源于diagnostics的原始marker信息
   */
  public updateMarkers(type: string, uri: string, rawMarkers: IMarkerData[]) {
    if (isFalsyOrEmpty(rawMarkers)) {
      // remove marker for this (owner,resource)-tuple
      const a = MapMap.remove(this._byResource, uri, type);
      const b = MapMap.remove(this._byType, type, uri);
      if (a !== b) {
        throw new Error('invalid marker service state');
      }
      if (a && b) {
        this.onMarkerChangedEmitter.fire([uri]);
      }
    } else {
      // insert marker for this (owner,resource)-tuple
      const markers: IMarkerData[] = [];
      for (const data of rawMarkers) {
        const marker = this.convertToMarker(type, uri, data);
        if (marker) {
          markers.push(marker);
        }
      }
      MapMap.set(this._byResource, uri, type, markers);
      MapMap.set(this._byType, type, uri, markers);
      this.onMarkerChangedEmitter.fire([uri]);
    }
  }

  /**
   * Marker数据类型转换
   * @param type marker类型
   * @param resource 资源uri
   * @param data marker数据
   */
  private convertToMarker(type: string, resource: string, data: IMarkerData): IMarker | undefined {
    const { message } = data;

    if (!message) {
      return undefined;
    }

    let { startLineNumber, startColumn, endLineNumber, endColumn } = data;

    // santize data
    // marker 的 startLineNumber 等是 1-base 的
    startLineNumber = startLineNumber > 0 ? startLineNumber : 1;
    startColumn = startColumn > 0 ? startColumn : 1;
    endLineNumber = endLineNumber >= startLineNumber ? endLineNumber : startLineNumber;
    endColumn = endColumn > 0 ? endColumn : startColumn;

    return {
      ...data,
      resource,
      type,
      message,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
    };
  }

  /**
   * 清空特定类型的marker
   * @param type 消息类型
   */
  public clearMarkers(type: string) {
    const changes: string[] = [];
    const map = this._byType[type];

    // remove old marker
    if (map) {
      delete this._byType[type];
      // eslint-disable-next-line guard-for-in
      for (const resource in map) {
        const entry = MapMap.get(this._byResource, resource, type);
        if (entry) {
          // remeber what we remove
          const [first] = entry;
          if (first) {
            changes.push(first.resource);
          }
          // actual remove
          MapMap.remove(this._byResource, resource, type);
        }
      }
    }

    this.onMarkerChangedEmitter.fire(changes);
  }

  /**
   * 清空给定uri的所有marker
   * @param resource 资源uri
   */
  public clearMarkersOfUri(resource: string) {
    const map = this._byResource[resource];
    if (map) {
      delete this._byResource[resource];
      // eslint-disable-next-line guard-for-in
      for (const type in map) {
        const entry = MapMap.get(this._byType, type, resource);
        if (entry) {
          // actual remove
          MapMap.remove(this._byType, type, resource);
        }
      }
    }
    this.onMarkerChangedEmitter.fire([resource]);
  }

  /**
   * 根据过滤条件，查询marker列表
   * - type 类型
   * - resource 资源URI
   * - severities 安全等级
   * - take 提取个数
   * - opened 是否过滤打开的
   * @param filter 过滤条件
   */
  public getMarkers(
    filter: { type?: string; resource?: string; severities?: number; take?: number; opened?: boolean } = Object.create(
      null,
    ),
  ): IMarker[] {
    const { type, resource, severities, opened } = filter;
    let { take } = filter;

    if (!take || take < 0) {
      take = -1;
    }

    if (type && resource) {
      // exactly one owner AND resource
      const data = MapMap.get(this._byResource, resource.toString(), type);
      if (!data) {
        return [];
      } else {
        const result: IMarker[] = [];
        for (const marker of data) {
          if (this.isTargetMarker(marker, severities, opened)) {
            const newLen = result.push(marker);
            if (take > 0 && newLen === take) {
              break;
            }
          }
        }
        return result;
      }
    } else if (!type && !resource) {
      // all
      const result: IMarker[] = [];
      // eslint-disable-next-line guard-for-in
      for (const key1 in this._byResource) {
        // eslint-disable-next-line guard-for-in
        for (const key2 in this._byResource[key1]) {
          for (const data of this._byResource[key1][key2]) {
            if (this.isTargetMarker(data, severities, opened)) {
              const newLen = result.push(data);
              if (take > 0 && newLen === take) {
                return result;
              }
            }
          }
        }
      }
      return result;
    } else {
      // of one resource OR owner
      const map: { [key: string]: IMarker[] } | undefined = type
        ? this._byType[type]
        : resource
        ? this._byResource[resource.toString()]
        : undefined;

      if (!map) {
        return [];
      }

      const result: IMarker[] = [];
      // eslint-disable-next-line guard-for-in
      for (const key in map) {
        for (const data of map[key]) {
          if (this.isTargetMarker(data, severities, opened)) {
            const newLen = result.push(data);
            if (take > 0 && newLen === take) {
              return result;
            }
          }
        }
      }
      return result;
    }
  }

  private isTargetMarker(marker: IMarker, severities?: number, visible?: boolean): boolean {
    const isTargetSeverity = severities === undefined || (severities & marker.severity) === marker.severity;
    const isTargetVisible = visible ? this._openedResource.has(marker.resource) : true;
    return isTargetSeverity && isTargetVisible;
  }

  public getResources(): string[] {
    return MapMap.keys(this._byResource);
  }

  public getStats(): MarkerStats {
    return this._stats;
  }

  public onEditorGroupOpen(resource: string) {
    this._openedResource.add(resource);
    const cacheMap = MapMap.removeMap(this._byResourceCloseCache, resource);
    if (cacheMap) {
      MapMap.setMap(this._byResource, resource, cacheMap);
      Object.keys(cacheMap).forEach((type) => {
        MapMap.set(this._byType, type, resource, cacheMap[type]);
      });
    }
    this.onMarkerChangedEmitter.fire([resource]);
  }

  public onEditorGroupClose(resource: string) {
    this._openedResource.delete(resource);
    const resourceToCache = MapMap.getMap(this._byResource, resource);
    if (resourceToCache) {
      MapMap.setMap(this._byResourceCloseCache, resource, resourceToCache);
    }
    this.clearMarkersOfUri(resource);
  }
}
