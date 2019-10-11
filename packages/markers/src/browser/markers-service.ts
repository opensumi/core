'use strict';

import { observable, computed } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { IMarkerData, IMarkerService, MarkerStatistics, MarkerSeverity } from '@ali/ide-core-common';

// export class MarkerChangePayload {}
// export class MarkerChangeEvent extends BasicEvent<MarkerChangePayload> {}

@Injectable()
export class MarkerService implements IMarkerService {

  // 所有Marker
  @observable
  private readonly markers = new Map<string, Map<string, IMarkerData[]> | undefined>();

  constructor() {
  }

  public updateMarkers(type: string, uri: string, markers: IMarkerData[]) {
    let targetMap = this.markers.get(type);
    if (!targetMap) {
      targetMap = new Map<string, IMarkerData[]>();
      this.markers.set(type, targetMap);
    }
    if (markers.length > 0) {
      targetMap.set(uri, markers);
    } else { // 有可能会传入空
      targetMap.delete(uri);
      if (targetMap.size <= 0) {
        this.markers.delete(type);
      }
    }
  }

  public clearMarkers(type: string) {
    this.markers.set(type, undefined);
  }

  public clearAll() {
    this.markers.clear();
  }

  public hasMarkers() {
    return this.markers.size > 0;
  }

  public getMarkers(type: string): Map<string, IMarkerData[]> | undefined {
    return this.markers.get(type);
  }

  public getAllMarkers() {
    return this.markers;
  }

  public getStatistics(): MarkerStatistics {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    let unknowns = 0;

    this.markers.forEach((map, _) => {
      if (!map) { return; }
      map.forEach((markers, _) => {
        if (!markers) { return; }
        markers.forEach((marker) => {
          if (!marker) { return; }
          switch (marker.severity) {
            case MarkerSeverity.Error: errors++; break;
            case MarkerSeverity.Warning: warnings++; break;
            case MarkerSeverity.Info: infos++; break;
            default:
              unknowns++;
          }
        });
      });
    });

    return {
      errors,
      warnings,
      infos,
      unknowns,
    };
  }
}
