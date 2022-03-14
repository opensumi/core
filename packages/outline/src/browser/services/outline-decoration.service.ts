import { Injectable, Autowired } from '@opensumi/di';
import { URI, MarkerManager, MarkerSeverity, IMarker } from '@opensumi/ide-core-browser';
import { IThemeService, listErrorForeground, listWarningForeground } from '@opensumi/ide-theme';

import { IOutlineMarker } from '../../common';
import { OutlineTreeNode } from '../outline-node.define';

@Injectable()
export class OutlineDecorationService {
  @Autowired()
  private markerManager: MarkerManager;

  @Autowired(IThemeService)
  private themeService: IThemeService;

  private _diagnosisInfo: IOutlineMarker[] = [];

  updateDiagnosisInfo(uri?: URI) {
    this._diagnosisInfo = uri ? this.markerManager.getMarkers({ resource: uri.toString(), opened: true }) : [];
  }

  getDecoration(node: OutlineTreeNode) {
    const markers: IOutlineMarker[] = [];
    let topMarker: IOutlineMarker | undefined;
    // 根据 node.raw.range 判断相交情况
    // 这里的相交判断实际上可以做一下数据裁剪
    const diagnosisInfos = this._diagnosisInfo.filter((marker: IMarker) => {
      if (
        marker.startLineNumber <= node.raw.range.startLineNumber &&
        marker.endLineNumber >= node.raw.range.startLineNumber
      ) {
        return true;
      } else if (
        node.raw.range.startLineNumber <= marker.startLineNumber &&
        node.raw.range.endLineNumber >= marker.startLineNumber
      ) {
        return true;
      }
      return false;
    });
    for (const marker of diagnosisInfos) {
      if (marker.severity === MarkerSeverity.Error || marker.severity === MarkerSeverity.Warning) {
        markers.push(marker);
      }
      if (!topMarker || marker.severity > topMarker.severity) {
        topMarker = marker;
      }
    }
    return {
      color:
        topMarker?.severity === MarkerSeverity.Error || topMarker?.severity === MarkerSeverity.Warning
          ? this.themeService.getColor({
              id: topMarker.severity === MarkerSeverity.Error ? listErrorForeground : listWarningForeground,
            })
          : undefined,
      tooltip: topMarker?.message,
      badge: markers.length > 0 ? (markers.length > 9 ? '9+' : markers.length + '') : '',
    };
  }
}
