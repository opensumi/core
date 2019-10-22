import { URI, MarkerSeverity, MarkerModel, IMarkerService, IMarker } from '@ali/ide-core-common';
import { isFalsyOrEmpty, mergeSort } from '../common/index';
import { observable } from 'mobx';
import { LabelService } from '@ali/ide-core-browser/lib/services';

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

export class MarkerViewModel {

  @observable
  public markers: Map<string, MarkerModel> = new Map<string, MarkerModel>();

  constructor(private _service: IMarkerService, private labelService: LabelService) {
    this._service.onMarkerChanged(this._onMarkerChanged, this);
  }

  private _onMarkerChanged(resources: string[]) {
    if (resources) {
      resources.forEach((resource) => {
        // tslint:disable-next-line: no-bitwise
        this.updateMarker(resource, this._service.getMarkers({ resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info }));
      });
    }
  }

  private updateMarker(resource: string, rawMarkers: IMarker[]) {
    if (isFalsyOrEmpty(rawMarkers)) {
      this.markers.delete(resource.toString());
    } else {
      const mergedMarkers = mergeSort(rawMarkers, compareMarkers);
      const {icon, filename, longname} = this.getUriInfos(resource);

      this.markers.set(resource.toString(), new MarkerModel(resource, icon, filename, longname, mergedMarkers));
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
