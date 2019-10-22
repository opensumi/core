import { isEmptyObject } from '../../utils/types';

export interface MapMap<V> {
	[key: string]: { [key: string]: V };
}

export namespace MapMap {
	export function get<V>(map: MapMap<V>, key1: string, key2: string): V | undefined {
		if (map[key1]) {
			return map[key1][key2];
		}
		return undefined;
	}

	export function set<V>(map: MapMap<V>, key1: string, key2: string, value: V): void {
		if (!map[key1]) {
			map[key1] = Object.create(null);
		}
		map[key1][key2] = value;
	}

	export function remove(map: MapMap<any>, key1: string, key2: string): boolean {
		if (map[key1] && map[key1][key2]) {
			delete map[key1][key2];
			if (isEmptyObject(map[key1])) {
				delete map[key1];
			}
			return true;
		}
		return false;
	}
}

/**
 * Marker的严重程度
 */
export enum MarkerSeverity {
  Hint = 1,
  Info = 2,
  Warning = 4,
  Error = 8,
}

export namespace MarkerSeverity {

	export function compare(a: MarkerSeverity, b: MarkerSeverity): number {
		return b - a;
  }

}

export const enum MarkerTag {
  Unnecessary = 1,
  Deprecated = 2,
}

/**
 * diagnosis的相关信息
 */
export interface IRelatedInformation {
  resource: string;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * A structure defining a problem/warning/etc.
 */
export interface IMarkerData {
  code?: string;
  severity: MarkerSeverity;
  message: string;
  source?: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  relatedInformation?: IRelatedInformation[];
  tags?: MarkerTag[];
}

export interface IMarker extends IMarkerData {
  type: string;
  resource: string;
}

/**
 * marker 信息统计
 */
export interface MarkerStatistics {
	errors: number;
	warnings: number;
	infos: number;
	unknowns: number;
}

/**
 * marker collection of given type (typescript/eslint/tslint/etc..)
 */
export class MarkerCollection {
  constructor(
    public type: string,
    public models: Map<string, MarkerModel> = new Map<string, MarkerModel>()
  ) { }

  public add(model: MarkerModel) {
    this.models.set(model.uri, model);
  }

  public delete(uri: string) {
    this.models.delete(uri);
  }

  public size() {
    return this.models.size;
  }
}

/**
 * marker modle of given url
 */
export class MarkerModel {
  public filetype: string;
  public fold: boolean = false;

  constructor(
    public readonly uri: string,
    public readonly icon: string,
    public readonly filename: string,
    public readonly longname: string,
    public markers: IMarkerData[],
  ) {
    this.filetype = this.uri && this.uri.substr(this.uri.lastIndexOf('.') + 1);
  }

  public addAll(markers: IMarkerData[]) {
    this.markers = this.markers.concat(markers);
  }

  /**
   * 根据severity等信息过滤marker
   * @param filter 过滤条件
   */
  public static filterMarkers(markers: IMarkerData[], filter: {severities?: number } = Object.create(null)) {
    const { severities } = filter;
    if (markers && markers.length > 0) {
      return markers.filter(marker => {
        return severities === undefined || (severities & marker.severity) === marker.severity;
      });
    }
    return [];
  }

  /**
   * 根据severity等信息过滤marker
   * @param filter 过滤条件
   */
  public filterMarkers(filter: {severities?: number } = Object.create(null)): IMarkerData[] {
    return MarkerModel.filterMarkers(this.markers, filter);
  }

  public size() {
    return this.markers && this.markers.length;
  }

  public toogle() {
    this.fold = !this.fold;
    return this.fold;
  }
}
