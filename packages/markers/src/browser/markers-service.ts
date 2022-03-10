'use strict';
import { observable } from 'mobx';
import { createRef } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import {
  Emitter,
  Event,
  IBaseMarkerManager,
  IMarkerData,
  MarkerManager,
  OnEvent,
  URI,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorGroupCloseEvent, EditorGroupOpenEvent } from '@opensumi/ide-editor/lib/browser';
import { ThemeType } from '@opensumi/ide-theme';
import { Themable } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';

import { IMarkerService } from '../common/types';

import { FilterOptions } from './markers-filter.model';
import { MarkerViewModel } from './markers.model';

const MAX_DIAGNOSTICS_BADGE = 1000;

export interface ViewSize {
  h: number;
}

@Injectable()
export class MarkerService extends Themable implements IMarkerService {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(MarkerManager)
  protected readonly markerManager: IBaseMarkerManager;

  // marker 显示模型
  private markerViewModel: MarkerViewModel;

  @observable
  public viewSize: ViewSize = { h: 0 };

  public rootEle = createRef<HTMLDivElement>();

  // marker filter 事件
  protected readonly onMarkerFilterChangedEmitter = new Emitter<FilterOptions | undefined>();
  public readonly onMarkerFilterChanged: Event<FilterOptions | undefined> = this.onMarkerFilterChangedEmitter.event;

  // resource 事件
  protected readonly onResourceOpenEmitter = new Emitter<string>();
  public readonly onResouceOpen: Event<string> = this.onResourceOpenEmitter.event;

  protected readonly onResourceCloseEmitter = new Emitter<string>();
  public readonly onResourceClose: Event<string> = this.onResourceCloseEmitter.event;

  constructor() {
    super();
    this.markerViewModel = new MarkerViewModel(this, this.labelService);
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

  /**
   * 打开编辑器
   * @param uri 资源uri
   * @param marker 当前选中的maker
   */
  public openEditor(uri: string, marker: IMarkerData) {
    this.workbenchEditorService!.open(new URI(uri), {
      disableNavigate: true,
      range: {
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn,
      },
    });
  }

  public getBadge(): string | undefined {
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
