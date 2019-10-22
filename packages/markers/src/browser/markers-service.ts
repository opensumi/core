'use strict';
import { Injectable, Autowired } from '@ali/common-di';
import { Event, Emitter, URI, IMarker, IMarkerData, IMarkerService, MapMap, MarkerStats } from '@ali/ide-core-common';
import { IThemeService, ThemeType } from '@ali/ide-theme';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { MarkerViewModel } from './markers-view-model';
import { isFalsyOrEmpty } from '../common/index';
import { LabelService } from '@ali/ide-core-browser/lib/services';

@Injectable()
export class MarkerService implements IMarkerService {

  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  // 所有Marker
  private readonly _byResource: MapMap<IMarker[]> = Object.create(null);
  private readonly _byType: MapMap<IMarker[]> = Object.create(null);

  // marker 变更事件
  private readonly onMarkerChangedEmitter = new Emitter<string[]>();
  public readonly onMarkerChanged: Event<string[]> = this.onMarkerChangedEmitter.event;

  private markerViewModel: MarkerViewModel;

  // 状态
  private _stats: MarkerStats;

  constructor() {
    this._stats = new MarkerStats(this);
    this.markerViewModel = new MarkerViewModel(this, this.labelService);
  }

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

  public getViewModel(): MarkerViewModel {
    return this.markerViewModel;
  }

  public getStats(): MarkerStats {
    return this._stats;
  }

  public getThemeType(): ThemeType {
    return this.themeService.getCurrentThemeSync().type;
  }

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
}
