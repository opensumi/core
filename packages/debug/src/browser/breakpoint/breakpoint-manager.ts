import { Injectable, Autowired } from '@opensumi/di';
import {
  Emitter,
  Event,
  URI,
  isUndefined,
  StorageProvider,
  IStorage,
  STORAGE_NAMESPACE,
  IReporterService,
} from '@opensumi/ide-core-browser';
import { Deferred } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { BreakpointsChangeEvent, DEBUG_REPORT_NAME, IDebugBreakpoint } from '../../common';
import { DebugModel } from '../editor';
import { MarkerManager, Marker } from '../markers';

import { DebugExceptionBreakpoint, BREAKPOINT_KIND } from './breakpoint-marker';

export interface ExceptionBreakpointsChangeEvent {
  filters: string[];
}

export interface SelectedBreakpoint {
  breakpoint?: IDebugBreakpoint;
  model: DebugModel;
}

@Injectable()
export class BreakpointManager extends MarkerManager<IDebugBreakpoint> {
  protected readonly owner = 'breakpoint';
  private _selectedBreakpoint: SelectedBreakpoint;

  private defaultExceptionFilter: DebugProtocol.ExceptionBreakpointsFilter[] = [];
  private exceptionFilterValue: { [key: string]: boolean } | undefined;
  private _affected = new Set<string>();

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(IReporterService)
  private readonly reporterService: IReporterService;

  getKind(): string {
    return BREAKPOINT_KIND;
  }

  get selectedBreakpoint() {
    return this._selectedBreakpoint;
  }

  set selectedBreakpoint(value: SelectedBreakpoint) {
    this._selectedBreakpoint = value;
  }

  get affected() {
    return Array.from(this._affected.values());
  }

  protected breakpointsDeffered: Deferred<void> | null = null;

  protected readonly onDidChangeBreakpointsEmitter = new Emitter<BreakpointsChangeEvent>();
  readonly onDidChangeBreakpoints: Event<BreakpointsChangeEvent> = this.onDidChangeBreakpointsEmitter.event;
  protected readonly onDidChangeExceptionsBreakpointsEmitter = new Emitter<ExceptionBreakpointsChangeEvent>();
  readonly onDidChangeExceptionsBreakpoints: Event<ExceptionBreakpointsChangeEvent> =
    this.onDidChangeExceptionsBreakpointsEmitter.event;

  public setBpDeffered(): this {
    this.breakpointsDeffered = new Deferred();
    return this;
  }

  public resolveBpDeffered(): void {
    if (this.breakpointsDeffered) {
      this.breakpointsDeffered.resolve();
    }
  }

  public promiseBpDeffered(): Promise<void> {
    if (this.breakpointsDeffered) {
      return this.breakpointsDeffered.promise;
    } else {
      return Promise.resolve();
    }
  }

  setMarkers(uri: URI, owner: string, newMarkers: IDebugBreakpoint[]): Marker<IDebugBreakpoint>[] {
    const result = super.setMarkers(uri, owner, newMarkers);
    const added: IDebugBreakpoint[] = [];
    const removed: IDebugBreakpoint[] = [];
    const changed: IDebugBreakpoint[] = [];
    const oldMarkers = new Map(result.map(({ data }) => [data.id, data] as [string, IDebugBreakpoint]));
    const ids = new Set<string>();

    for (const newMarker of newMarkers) {
      ids.add(newMarker.id);
      if (oldMarkers.has(newMarker.id)) {
        changed.push(newMarker);
      } else {
        added.push(newMarker);
      }
    }
    for (const [id, data] of oldMarkers.entries()) {
      if (!ids.has(id)) {
        removed.push(data);
      }
    }
    this.onDidChangeBreakpointsEmitter.fire({ affected: [uri], added, removed, changed });
    return result;
  }

  getBreakpoint(uri: URI, filter: number | Partial<monaco.IPosition> | undefined): IDebugBreakpoint | undefined {
    if (typeof filter === 'number') {
      filter = { lineNumber: filter };
    }
    return this.getBreakpoints(uri, filter)[0];
  }

  getBreakpoints(uri?: URI, filter?: Partial<monaco.IPosition>): IDebugBreakpoint[] {
    let dataFilter: ((breakpoint: IDebugBreakpoint) => boolean) | undefined;
    if (filter) {
      dataFilter = (breakpoint: IDebugBreakpoint) => {
        if (
          (filter.lineNumber && breakpoint.raw.line !== filter.lineNumber) ||
          (filter.column && breakpoint.raw.column !== filter.column)
        ) {
          return false;
        }
        return true;
      };
    }
    return this.findMarkers({
      uri,
      dataFilter,
    }).map((marker) => marker.data);
  }

  setBreakpoints(uri: URI, breakpoints: IDebugBreakpoint[]): void {
    if (breakpoints.length > 0) {
      this._affected.add(uri.toString());
    } else {
      this._affected.delete(uri.toString());
    }
    this.setMarkers(
      uri,
      this.owner,
      breakpoints.sort((a, b) => a.raw.line - b.raw.line),
    );
  }

  addBreakpoint(breakpoint: IDebugBreakpoint): boolean {
    const uri = new URI(breakpoint.uri);
    const breakpoints = this.getBreakpoints(uri);
    const existed = breakpoints.find(
      ({ raw }) => raw.line === breakpoint.raw.line && raw.column === breakpoint.raw.column,
    );
    this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_BREAKPOINT, 'add');
    if (!existed) {
      this.setBreakpoints(uri, [...breakpoints, breakpoint]);
      return true;
    }
    return false;
  }

  delBreakpoint(breakpoint: IDebugBreakpoint): boolean {
    const uri = URI.parse(breakpoint.uri);
    const breakpoints = this.getBreakpoints(uri);
    const index = breakpoints.findIndex((bp) => bp.id === breakpoint.id);
    if (index > -1) {
      breakpoints.splice(index, 1);
      this.setBreakpoints(uri, ([] as IDebugBreakpoint[]).concat(breakpoints));
      return true;
    }
    return false;
  }

  clearBreakpoints() {
    const affected = new Set<string>();
    const breakpoints = this.getBreakpoints();
    breakpoints.map((b) => affected.add(b.uri));
    this.cleanAllMarkers();
    this._affected.clear();
    this.onDidChangeBreakpointsEmitter.fire({
      affected: Array.from(affected.values()).map((str) => URI.parse(str)),
      added: [],
      removed: breakpoints,
      changed: [],
    });
  }

  updateBreakpoint(breakpoint: IDebugBreakpoint, statusUpdated = false) {
    const uri = URI.parse(breakpoint.uri);
    this.onDidChangeBreakpointsEmitter.fire({
      affected: [uri],
      added: [],
      removed: [],
      changed: [breakpoint],
      statusUpdated,
    });
  }

  updateBreakpoints(breakpoints: IDebugBreakpoint[], statusUpdated = false) {
    const uriStrings = new Set<string>();
    breakpoints.forEach((breakpoint) => {
      uriStrings.add(breakpoint.uri);
    });
    this.onDidChangeBreakpointsEmitter.fire({
      affected: Array.from(uriStrings.values()).map((v) => URI.parse(v)),
      added: [],
      removed: [],
      changed: breakpoints,
      statusUpdated,
    });
  }

  enableAllBreakpoints(enabled: boolean): void {
    for (const uriString of this.getUris()) {
      let didChange = false;
      const uri = new URI(uriString);
      const markers = this.findMarkers({ uri });
      for (const marker of markers) {
        if (marker.data.enabled !== enabled) {
          marker.data.enabled = enabled;
          didChange = true;
        }
      }
      if (didChange) {
        this.fireOnDidChangeMarkers(uri);
      }
    }
  }

  protected _breakpointsEnabled = true;
  get breakpointsEnabled(): boolean {
    return this._breakpointsEnabled;
  }
  set breakpointsEnabled(breakpointsEnabled: boolean) {
    if (this._breakpointsEnabled !== breakpointsEnabled) {
      this._breakpointsEnabled = breakpointsEnabled;
      for (const uri of this.getUris()) {
        this.fireOnDidChangeMarkers(new URI(uri));
      }
      this.updateBreakpoints(this.getBreakpoints());
    }
  }

  async load(): Promise<void> {
    const storage: IStorage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    const data = storage.get<BreakpointManager.Data>('breakpoints', {
      breakpointsEnabled: true,
      breakpoints: {},
      defaultExceptionFilter: [],
    });
    this._breakpointsEnabled = data!.breakpointsEnabled;
    // eslint-disable-next-line guard-for-in
    for (const uri in data!.breakpoints) {
      this.setBreakpoints(
        new URI(uri),
        data!.breakpoints[uri].map((v) => Object.assign(v, { status: new Map() })),
      );
    }
    this.defaultExceptionFilter = data.defaultExceptionFilter || [];
    this.exceptionFilterValue = {};
    this.defaultExceptionFilter.forEach((item) => {
      this.exceptionFilterValue![item.filter] = !!item.default;
    });
  }

  async save(): Promise<void> {
    const data: BreakpointManager.Data = {
      breakpointsEnabled: this.breakpointsEnabled,
      breakpoints: {},
      defaultExceptionFilter: this.defaultExceptionFilter,
    };
    const uris = this.getUris();
    for (const uri of uris) {
      data.breakpoints[uri] = this.findMarkers({ uri: new URI(uri) }).map((marker) => marker.data);
    }
    const storage: IStorage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    await storage.set('breakpoints', data);
  }

  clearAllStatus(sessionId: string) {
    const breakpoints = this.getBreakpoints();
    breakpoints.forEach((breakpoint) => {
      breakpoint.status.delete(sessionId);
    });
    this.updateBreakpoints(breakpoints);
  }

  /**
   * 设置异常断点元信息
   * @param session
   * @param filter
   */
  setExceptionBreakpoints(filters: DebugProtocol.ExceptionBreakpointsFilter[]) {
    this.defaultExceptionFilter = filters;
    for (const item of filters) {
      if (!isUndefined(this.exceptionFilterValue)) {
        this.updateExceptionBreakpoints(
          item.filter,
          isUndefined(this.exceptionFilterValue[item.filter]) ? !!item.default : this.exceptionFilterValue[item.filter],
        );
      } else {
        this.updateExceptionBreakpoints(item.filter, !!item.default);
      }
    }
  }

  /**
   * 获取异常断点元信息
   * @param session
   */
  getExceptionBreakpoints(): DebugExceptionBreakpoint[] {
    return this.defaultExceptionFilter.map((breakpoint) => ({
      ...breakpoint,
      default: (this.exceptionFilterValue || {})[breakpoint.filter] || false,
    }));
  }

  /**
   * 通知DebugSession更新Exception配置
   * @param exceptionBreakpoints
   */
  updateExceptionBreakpoints(filter: string, value: boolean) {
    if (isUndefined(this.exceptionFilterValue)) {
      this.exceptionFilterValue = {};
    }
    this.exceptionFilterValue[filter] = value;

    const filters = this.defaultExceptionFilter
      .filter((exp) => (this.exceptionFilterValue || {})[exp.filter])
      .map((exp) => exp.filter);
    this.onDidChangeExceptionsBreakpointsEmitter.fire({ filters });
  }
}

export namespace BreakpointManager {
  export interface Data {
    breakpointsEnabled: boolean;
    breakpoints: {
      [uri: string]: IDebugBreakpoint[];
    };
    defaultExceptionFilter: DebugExceptionBreakpoint[];
  }
}
