import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IMarker, MarkerSeverity, URI } from '@ali/ide-core-common';
import { observable } from 'mobx';
import { isFalsyOrEmpty, mergeSort } from '../common/index';
import { IMarkerService, IMarkerModel } from '../common/types';
import { Filter, FilterOptions, IFilterMarkerItem } from './markers-filter.model';

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
 * marker model of given url
 */
export class MarkerModel implements IMarkerModel {
  constructor(
    public readonly uri: string,
    public readonly icon: string,
    public readonly filename: string,
    public readonly longname: string,
    public markers: IFilterMarkerItem[],
  ) { }

  public size() {
    return this.markers && this.markers.length;
  }
}

export class MarkerViewModel {

  @observable
  public markers: Map<string, IMarkerModel> = new Map<string, IMarkerModel>();

  // 过滤选项
  @observable.ref
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
      const mergedMarkers = mergeSort(rawMarkers, compareMarkers);
      const {icon, filename, longname} = this.getUriInfos(resource);

      const markerModel = new MarkerModel(resource, icon, filename, longname, mergedMarkers);
      if (this.filter) {
        const filterResult = this.filter.filterModel(markerModel);
        if (filterResult.match) {
          this.markers.set(resource.toString(), filterResult);
        }
      } else {
        this.markers.set(resource.toString(), markerModel);
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

}
