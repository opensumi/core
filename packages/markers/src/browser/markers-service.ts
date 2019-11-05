'use strict';
import { Autowired, Injectable } from '@ali/common-di';
import { useInjectable, WithEventBus } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Emitter, Event, IMarker, IMarkerData, MapMap, MarkerStats, URI, OnEvent } from '@ali/ide-core-common';
import { EditorGroupOpenEvent, EditorGroupCloseEvent } from '@ali/ide-editor/lib/browser';
import { isFalsyOrEmpty } from '@ali/ide-core-common/lib/arrays';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IThemeService, ThemeType } from '@ali/ide-theme';
import { IMarkerService } from '../common/types';
import { FilterOptions } from './markers-filter.model';
import { MarkerViewModel } from './markers.model';

const MAX_DIAGNOSTICS_BADGE = 1000;

@Injectable()
export class MarkerService extends WithEventBus implements IMarkerService {

  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  // 所有Marker
  private readonly _byResource: MapMap<IMarker[]> = Object.create(null);
  private readonly _byType: MapMap<IMarker[]> = Object.create(null);

  private readonly _byResourceCloseCache: MapMap<IMarker[]> = Object.create(null);
  private readonly _byTypeCloseCache: MapMap<IMarker[]> = Object.create(null);

  // marker 显示模型
  private markerViewModel: MarkerViewModel;

  // marker 当前状态
  private _stats: MarkerStats;

  // marker 变更 事件
  private readonly onMarkerChangedEmitter = new Emitter<string[]>();
  public readonly onMarkerChanged: Event<string[]> = this.onMarkerChangedEmitter.event;

  // marker filter 事件
  private readonly onMarkerFilterChangedEmitter = new Emitter<FilterOptions | undefined>();
  public readonly onMarkerFilterChanged: Event<FilterOptions | undefined> = this.onMarkerFilterChangedEmitter.event;

  constructor() {
    super();
    this._stats = new MarkerStats(this);
    this.markerViewModel = new MarkerViewModel(this, this.labelService);
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpen(e: EditorGroupOpenEvent) {
    // TODO，重新打开没有走changeDiagnostics事件
    const uri = e.payload.resource.uri;
    const resource = uri.toString();

    const cacheMap = MapMap.removeMap(this._byResourceCloseCache, resource);
    if (cacheMap) {
      MapMap.setMap(this._byResource, resource, cacheMap);
      Object.keys(cacheMap).forEach((type) => {
        MapMap.set(this._byType, type, resource, cacheMap[type]);
      });
      this.onMarkerChangedEmitter.fire([resource]);
    }
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupClose(e: EditorGroupCloseEvent) {
    const uri = e.payload.resource.uri;
    const resource = uri.toString();

    const resourceToCache = MapMap.getMap(this._byResource, resource);
    if (resourceToCache) {
      MapMap.setMap(this._byResourceCloseCache, resource, resourceToCache);
    }
    this.clearMarkersOfUri(resource);
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
   * 清空特定类型的marker
   * @param type 消息类型
   */
  public clearMarkers(type: string) {
    const changes: string[] = [];
    const map = this._byType[type];

    // remove old marker
    if (map) {
      delete this._byType[type];
      // tslint:disable-next-line: forin
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
      // tslint:disable-next-line: forin
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
   * @param filter 过滤条件
   */
  public getMarkers(filter: { type?: string; resource?: string; severities?: number, take?: number; } = Object.create(null)): IMarker[] {
    const { type, resource, severities } = filter;
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
          if (this.isTargetServerity(marker, severities)) {
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
      // tslint:disable-next-line: forin
      for (const key1 in this._byResource) {
        // tslint:disable-next-line: forin
        for (const key2 in this._byResource[key1]) {
          for (const data of this._byResource[key1][key2]) {
            if (this.isTargetServerity(data, severities)) {
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
      const map: { [key: string]: IMarker[] } | undefined = type ? this._byType[type] : resource ? this._byResource[resource.toString()] : undefined;

      if (!map) {
        return [];
      }

      const result: IMarker[] = [];
      // tslint:disable-next-line: forin
      for (const key in map) {
        for (const data of map[key]) {
          if (this.isTargetServerity(data, severities)) {
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

  public fireFilterChanged(opt: FilterOptions | undefined) {
    this.onMarkerFilterChangedEmitter.fire(opt);
  }

  public getResources(): string[] {
    return MapMap.keys(this._byResource);
  }

  public getViewModel(): MarkerViewModel {
    return this.markerViewModel;
  }

  public getStats(): MarkerStats {
    return this._stats;
  }

  public getBadge(): string | undefined {
    if (this._stats) {
      const total = this._stats.errors + this._stats.infos + this._stats.warnings;
      if (total > MAX_DIAGNOSTICS_BADGE) {
        return '1K+';
      } else if (total === MAX_DIAGNOSTICS_BADGE) {
        return '1K';
      } else if (total > 0) {
        return String(total);
      }
    }
    return undefined;
  }

  public getUris(): string[] {
    return MapMap.keys(this._byResource);
  }

  public getThemeType(): ThemeType {
    return this.themeService.getCurrentThemeSync().type;
  }

  /**
   * 打开编辑器
   * @param uri 资源uri
   * @param marker 当前选中的maker
   */
  public openEditor(uri: string, marker: IMarkerData) {
    this.workbenchEditorService!.open(new URI(uri), {
      disableNavigate: true,
      range: {
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn,
      },
    });
  }

  /**
   * Marker数据类型转换
   * @param type marker类型
   * @param resource 资源uri
   * @param data marker数据
   */
  private convertToMarker(type: string, resource: string, data: IMarkerData): IMarker | undefined {
    const { code, severity, message, source, relatedInformation, tags } = data;

    if (!message) {
      return undefined;
    }

    let { startLineNumber, startColumn, endLineNumber, endColumn } = data;

    // santize data
    startLineNumber = startLineNumber > 0 ? startLineNumber : 1;
    startColumn = startColumn > 0 ? startColumn : 1;
    endLineNumber = endLineNumber >= startLineNumber ? endLineNumber : startLineNumber;
    endColumn = endColumn > 0 ? endColumn : startColumn;

    return {
      resource,
      type,
      code,
      severity,
      message,
      source,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
      relatedInformation,
      tags,
    };
  }

  private isTargetServerity(marker: IMarker, severities?: number): boolean {
    // tslint:disable-next-line: no-bitwise
    return severities === undefined || (severities & marker.severity) === marker.severity;
  }

  /**
   * 给ui用的工具方法
   */
  public static useInjectable(): MarkerService {
    return useInjectable<IMarkerService>(MarkerService) as MarkerService;
  }
}
