'use strict';
import { Autowired, Injectable } from '@ali/common-di';
import { useInjectable } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Emitter, Event, IBaseMarkerManager, IMarkerData, MarkerManager, OnEvent, URI } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { EditorGroupCloseEvent, EditorGroupOpenEvent } from '@ali/ide-editor/lib/browser';
import { IThemeService, ThemeType } from '@ali/ide-theme';
import { IMarkerService } from '../common/types';
import { FilterOptions } from './markers-filter.model';
import { MarkerViewModel } from './markers.model';

const MAX_DIAGNOSTICS_BADGE = 1000;

@Injectable()
export class MarkerService implements IMarkerService {

  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(MarkerManager)
  private readonly markerManager: IBaseMarkerManager;

  // marker 显示模型
  private markerViewModel: MarkerViewModel;

  // marker filter 事件
  private readonly onMarkerFilterChangedEmitter = new Emitter<FilterOptions | undefined>();
  public readonly onMarkerFilterChanged: Event<FilterOptions | undefined> = this.onMarkerFilterChangedEmitter.event;

  constructor() {
    this.markerViewModel = new MarkerViewModel(this, this.labelService);
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpen(e: EditorGroupOpenEvent) {
    // TODO，重新打开没有走changeDiagnostics事件
    const uri = e.payload.resource.uri;
    const resource = uri.toString();
    this.markerManager.onEditorGroupOpen(resource);
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupClose(e: EditorGroupCloseEvent) {
    const uri = e.payload.resource.uri;
    const resource = uri.toString();
    this.markerManager.onEditorGroupClose(resource);
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

  /**
   * 给ui用的工具方法
   */
  public static useInjectable(): MarkerService {
    return useInjectable<IMarkerService>(MarkerService) as MarkerService;
  }
}
