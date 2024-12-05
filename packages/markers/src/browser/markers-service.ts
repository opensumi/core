import { Autowired, Injectable } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Deferred, Emitter, Event, IBaseMarkerManager, MarkerManager, OnEvent } from '@opensumi/ide-core-common';
import { EditorGroupCloseEvent, EditorGroupOpenEvent } from '@opensumi/ide-editor/lib/browser';
import { ThemeType } from '@opensumi/ide-theme';
import { Themable } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';

import { IMarkerService } from '../common/types';

import { MarkersContextKey } from './markers-contextkey';
import { FilterOptions } from './markers-filter.model';
import { MarkerViewModel } from './markers.model';
import { MarkerGroupNode, MarkerNode, MarkerRoot } from './tree/tree-node.defined';

import type { ViewBadge } from 'vscode';

const MAX_DIAGNOSTICS_BADGE = 1000;

@Injectable()
export class MarkerService extends Themable implements IMarkerService {
  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(MarkerManager)
  protected readonly markerManager: IBaseMarkerManager;

  // marker 显示模型
  private markerViewModel: MarkerViewModel;

  @Autowired(MarkersContextKey)
  markersContextKey: MarkersContextKey;

  private viewReadyDeferred = new Deferred<void>();
  get viewReady() {
    return this.viewReadyDeferred.promise;
  }

  // marker filter 事件
  protected readonly onMarkerFilterChangedEmitter = new Emitter<FilterOptions | undefined>();
  public readonly onMarkerFilterChanged: Event<FilterOptions | undefined> = this.onMarkerFilterChangedEmitter.event;

  // resource 事件
  protected readonly onResourceOpenEmitter = new Emitter<string>();
  public readonly onResourceOpen: Event<string> = this.onResourceOpenEmitter.event;

  protected readonly onResourceCloseEmitter = new Emitter<string>();
  public readonly onResourceClose: Event<string> = this.onResourceCloseEmitter.event;

  constructor() {
    super();
    this.markerViewModel = new MarkerViewModel(this, this.labelService);
  }

  get contextKey() {
    return this.markersContextKey;
  }

  initContextKey(dom: HTMLDivElement) {
    this.markersContextKey.initScopedContext(dom);
    this.viewReadyDeferred.resolve();
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpen(e: EditorGroupOpenEvent) {
    const uri = e.payload.resource.uri;
    const resource = uri.toString();
    this.markerManager.onEditorGroupOpen(resource);
    this.onResourceOpenEmitter.fire(resource);
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupClose(e: EditorGroupCloseEvent) {
    const uri = e.payload.resource.uri;
    const resource = uri.toString();
    this.markerManager.onEditorGroupClose(resource);
    this.onResourceCloseEmitter.fire(resource);
  }

  public resolveChildren(parent?: MarkerGroupNode | undefined) {
    if (!parent) {
      return [new MarkerRoot(this)];
    } else {
      if (MarkerRoot.is(parent)) {
        return Array.from(this.markerViewModel.markers.values()).map(
          (model) => new MarkerGroupNode(this, model, parent),
        );
      } else {
        if (!MarkerGroupNode.is(parent)) {
          return [];
        }
        return (parent as MarkerGroupNode).model.markers.map((marker) => new MarkerNode(this, marker, parent));
      }
    }
  }

  public fireFilterChanged(opt: FilterOptions | undefined) {
    this.onMarkerFilterChangedEmitter.fire(opt);
  }

  public getViewModel(): MarkerViewModel {
    return this.markerViewModel;
  }

  public getThemeType(): ThemeType {
    return this.themeService.getCurrentThemeSync().type;
  }

  public getManager(): IBaseMarkerManager {
    return this.markerManager;
  }

  public getBadge(): string | ViewBadge | undefined {
    const stats = this.markerManager.getStats();
    if (stats) {
      const total = stats.errors + stats.infos + stats.warnings;
      if (total > MAX_DIAGNOSTICS_BADGE) {
        return '1K+';
      } else if (total === MAX_DIAGNOSTICS_BADGE) {
        return '1K';
      } else if (total > 0) {
        return String(total);
      }
    }
    return undefined;
  }
}
