import { isEmptyObject, URI } from '@opensumi/ide-utils';

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

  export function getMap<V>(map: MapMap<V>, key: string): { [key: string]: V } | undefined {
    return map[key];
  }

  export function set<V>(map: MapMap<V>, key1: string, key2: string, value: V): void {
    if (!map[key1]) {
      map[key1] = Object.create(null);
    }
    map[key1][key2] = value;
  }

  export function setMap<V>(map: MapMap<V>, key: string, value: { [key: string]: V }): void {
    map[key] = value;
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

  export function removeMap<V>(map: MapMap<V>, key: string): { [key: string]: V } | undefined {
    if (map[key]) {
      const result = map[key];
      delete map[key];
      return result;
    }
    return undefined;
  }

  export function keys(map: MapMap<any>): string[] {
    const result: string[] = [];
    if (map) {
      // eslint-disable-next-line guard-for-in
      for (const key in map) {
        result.push(key);
      }
    }
    return result;
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
  codeHref?: URI;
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
