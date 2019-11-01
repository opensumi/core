import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IMarker, MarkerSeverity, URI } from '@ali/ide-core-common';
import { isFalsyOrEmpty, mergeSort } from '@ali/ide-core-common/lib/arrays';
import { observable } from 'mobx';
import { IMarkerService, MarkerModelBuilder, IRenderableMarkerModel } from '../common';
import { Filter, FilterOptions } from './markers-filter.model';

function compareMarkers(a: IMarker, b: IMarker): number {
  return MarkerSeverity.compare(a.severity, b.severity) || compareRangesUsingStarts(a, b);
}

function compareRangesUsingStarts(a: IMarker, b: IMarker): number {
  if (a && b) {
    const aStartLineNumber = a.startLineNumber || 0;
    const bStartLineNumber = b.startLineNumber || 0;

    if (aStartLineNumber === bStartLineNumber) {
      const aStartColumn = a.startColumn || 0;
      const bStartColumn = b.startColumn || 0;

      if (aStartColumn === bStartColumn) {
        const aEndLineNumber = a.endLineNumber || 0;
        const bEndLineNumber = b.endLineNumber || 0;

        if (aEndLineNumber === bEndLineNumber) {
          const aEndColumn = a.endColumn || 0;
          const bEndColumn = b.endColumn || 0;
          return aEndColumn - bEndColumn;
        }
        return aEndLineNumber - bEndLineNumber;
      }
      return aStartColumn - bStartColumn;
    }
    return aStartLineNumber - bStartLineNumber;
  }
  const aExists = (a ? 1 : 0);
  const bExists = (b ? 1 : 0);
  return aExists - bExists;
}

/**
 * marker view model for display
 */
export class MarkerViewModel {

  // view data
  @observable
  public markers: Map<string, IRenderableMarkerModel> = new Map<string, IRenderableMarkerModel>();

  // marker filter
  private filter: Filter | undefined;

  constructor(private _service: IMarkerService, private labelService: LabelService) {
    this._service.onMarkerChanged(this._onMarkerChanged, this);
    this._service.onMarkerFilterChanged(this._onMarkerFilterChanged, this);
  }

  private _onMarkerChanged(resources: string[]) {
    if (resources) {
      resources.forEach((resource) => {
        // tslint:disable-next-line: no-bitwise
        this.updateMarker(resource, this._service.getMarkers({resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info}));
      });
    }
  }

  private _onMarkerFilterChanged(opt: FilterOptions | undefined) {
    this.filter = opt ? new Filter(opt) : undefined;
    const resources = this._service.getResources();
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
      } else {// TODO 考虑优化性能
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
