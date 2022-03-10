import { observable } from 'mobx';

import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IMarker, MarkerSeverity, URI, Disposable, compareRangesUsingStarts } from '@opensumi/ide-core-common';
import { isFalsyOrEmpty, mergeSort } from '@opensumi/ide-core-common/lib/arrays';

import { IMarkerService, IRenderableMarkerModel, MarkerModelBuilder } from '../common';

import { Filter, FilterOptions } from './markers-filter.model';

function compareMarkers(a: IMarker, b: IMarker): number {
  return MarkerSeverity.compare(a.severity, b.severity) || compareRangesUsingStarts(a, b);
}

/**
 * marker view model for display
 */
export class MarkerViewModel extends Disposable {
  // view data
  @observable
  public markers: Map<string, IRenderableMarkerModel> = new Map<string, IRenderableMarkerModel>();

  // marker filter
  private filter: Filter | undefined;

  constructor(private _service: IMarkerService, private labelService: LabelService) {
    super();
    this.addDispose([
      this._service.getManager().onMarkerChanged(this._onMarkerChanged, this),
      this._service.onMarkerFilterChanged(this._onMarkerFilterChanged, this),
    ]);
  }

  private _onMarkerChanged(resources: string[]) {
    if (resources) {
      resources.forEach((resource) => {
        // tslint:disable-next-line: no-bitwise
        this.updateMarker(
          resource,
          this._service
            .getManager()
            .getMarkers({ resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info }),
        );
      });
    }
  }

  private _onMarkerFilterChanged(opt: FilterOptions | undefined) {
    this.filter = opt ? new Filter(opt) : undefined;
    const resources = this._service.getManager().getResources();
    if (resources) {
      this._onMarkerChanged(resources);
    }
  }

  private updateMarker(resource: string, rawMarkers: IMarker[]) {
    if (isFalsyOrEmpty(rawMarkers)) {
      this.markers.delete(resource.toString());
    } else {
      const markers = mergeSort(rawMarkers, compareMarkers);
      const { icon, filename, longname } = this.getUriInfos(resource);

      const markerModel = MarkerModelBuilder.buildModel(resource, icon, filename, longname, markers);

      if (this.filter) {
        const filterResult = this.filter.filterModel(markerModel);
        if (filterResult.match) {
          this.markers.set(resource, filterResult);
        } else {
          this.markers.delete(resource);
        }
      } else {
        this.markers.set(resource, markerModel);
      }
    }
  }

  private getUriInfos(uri: string) {
    const target = new URI(uri);
    return {
      icon: this.labelService.getIcon(target),
      filename: this.labelService.getName(target),
      longname: this.labelService.getLongName(target),
    };
  }

  public hasData() {
    return this.markers.size > 0;
  }

  public hasFilter() {
    return this.filter !== undefined;
  }
}
