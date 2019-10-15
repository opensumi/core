'use strict';

import { observable, computed } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { URI, IMarkerData, IMarkerService, MarkerStatistics, MarkerSeverity, MarkerModel } from '@ali/ide-core-common';
import { LabelService } from '@ali/ide-core-browser/lib/services';

// export class MarkerChangePayload {}
// export class MarkerChangeEvent extends BasicEvent<MarkerChangePayload> {}

@Injectable()
export class MarkerService implements IMarkerService {

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  // 所有Marker
  @observable
  private readonly markers = new Map<string, Map<string, MarkerModel> | undefined>();

  constructor() {
  }

  public updateMarkers(type: string, uri: string, markers: IMarkerData[]) {
    let targetCollection = this.markers.get(type);
    if (!targetCollection) {
      targetCollection = new Map<string, MarkerModel>();
      this.markers.set(type, targetCollection);
    }
    if (markers.length > 0) {
      const { icon, filename, longname } = this.getUriInfos(uri);
      const markerModel = new MarkerModel(uri, icon, filename, longname, markers);
      targetCollection.set(uri, markerModel);
    } else { // 有可能会传入空
      targetCollection.delete(uri);
      if (targetCollection.size <= 0) {
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

  public getMarkers(type: string) {
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

    this.markers.forEach((collection, _) => {
      if (!collection) { return; }
      collection.forEach((model, _) => {
        if (!model || !model.markers) { return; }
        model.markers.forEach((marker) => {
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

  public getUriInfos(uri: string) {
    const target = new URI(uri);
    return {
      icon: this.labelService.getIcon(target),
      filename: this.labelService.getName(target),
      longname: this.labelService.getLongName(target),
    };
  }
}
