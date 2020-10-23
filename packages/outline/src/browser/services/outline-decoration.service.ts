import { Injectable, Autowired } from '@ali/common-di';
import { URI, MarkerManager, IRange, MarkerSeverity } from '@ali/ide-core-browser';
import { IThemeService, listErrorForeground, listWarningForeground } from '@ali/ide-theme';
import { IOutlineMarker } from '../outline.service';
import { OutlineTreeNode } from '../outline-node.define';
import { binarySearch, coalesceInPlace } from '@ali/ide-core-common/lib/arrays';

@Injectable()
export class OutlineDecorationService {
  @Autowired()
  private markerManager: MarkerManager;

  @Autowired(IThemeService)
  private themeService: IThemeService;

  private _diagnosisInfo: IOutlineMarker[];

  updateDiagnosisInfo(uri?: URI) {
    this._diagnosisInfo = uri ? this.markerManager.getMarkers({ resource: uri.toString(), opened: true }) : [];
  }

  getDecoration(node: OutlineTreeNode) {
     const idx = binarySearch<IRange>(this._diagnosisInfo, node.raw.range, monaco.Range.compareRangesUsingStarts);
     let start: number;
     if (idx < 0) {
      // tslint:disable-next-line: no-bitwise
      start = ~idx;
      if (start > 0 && monaco.Range.areIntersecting(this._diagnosisInfo[start - 1], node.raw.range)) {
        start -= 1;
      }
    } else {
      start = idx;
    }

     const myMarkers: IOutlineMarker[] = [];
     let myTopSev: MarkerSeverity | undefined;

     for (; start < this._diagnosisInfo.length && monaco.Range.areIntersecting(node.raw.range, this._diagnosisInfo[start]); start++) {
      // 将与目标节点range相交的marker信息存入内部数组myMarkers，用于子节点的计算
      // 在遍历相交marker信息的同时，获取问题严重性的最大值
      const marker = this._diagnosisInfo[start];
      myMarkers.push(marker);
      // 清空父节点与当前节点相关的marker信息条目
      (this._diagnosisInfo as Array<IOutlineMarker | undefined>)[start] = undefined;
      if (!myTopSev || marker.severity > myTopSev) {
        myTopSev = marker.severity;
      }
    }
    // 清空非真的数组元素
     coalesceInPlace(this._diagnosisInfo);
     return {
      color: this.themeService.getColor({ id: myTopSev === MarkerSeverity.Error ? listErrorForeground : listWarningForeground }),
      tooltip: '',
      badge: myMarkers.length > 0 ? (myMarkers.length > 9 ? '9+' : myMarkers.length + '') : '•',
    };
  }
}
