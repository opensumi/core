/**
 * Marker的严重程度
 */
export enum MarkerSeverity {
  Hint = 1,
  Info = 2,
  Warning = 4,
  Error = 8,
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

  public size() {
    return this.markers && this.markers.length;
  }

  public toogle() {
    this.fold = !this.fold;
    return this.fold;
  }
}
