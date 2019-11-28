import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { View } from '@ali/ide-core-browser';
import { action, observable } from 'mobx';
import { SplitPanelManager, SplitPanelService } from '@ali/ide-core-browser/lib/components/layout/split-panel.service';
import { AbstractMenuService, IMenu } from '@ali/ide-core-browser/lib/menu/next';
import { RESIZE_LOCK } from '@ali/ide-core-browser/lib/components';

export interface SectionState {
  collapsed: boolean;
  hidden: boolean;
  size?: number;
}

@Injectable({multiple: true})
export class AccordionService {
  @Autowired()
  splitPanelManager: SplitPanelManager;

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  splitPanelService: SplitPanelService;

  @observable.shallow views: View[] = [];

  @observable state: Map<string, SectionState> = new Map();

  private headerSize: number;
  private minSize: number;

  constructor(public containerId: string) {
    this.splitPanelService = this.splitPanelManager.getService(containerId);
  }

  initConfig(config: { headerSize: number; minSize: number; }) {
    const {headerSize, minSize} = config;
    this.headerSize = headerSize;
    this.minSize = minSize;
  }

  getSectionToolbarMenu(viewId: string): IMenu {
    const menu = this.menuService.createMenu(`container/${viewId}`);
    return menu;
  }

  appendView(view: View) {
    const index = this.views.findIndex((value) => (value.priority || 0) < (view.priority || 0));
    this.views.splice(index === -1 ? this.views.length : index, 0, view);
  }

  toggleViewVisibility(viewId: string, show?: boolean) {
    const viewState = this.getViewState(viewId);
    if (show === undefined) {
      viewState.hidden = !viewState.hidden;
    } else {
      viewState.hidden = !show;
    }
  }

  get visibleViews(): View[] {
    return this.views.filter((view) => {
      const viewState = this.getViewState(view.id);
      return !viewState.hidden;
    });
  }

  get expandedViews(): View[] {
    return this.views.filter((view) => {
      const viewState = this.state.get(view.id);
      return !viewState || viewState && !viewState.collapsed;
    });
  }

  @action.bound handleSectionClick(viewId: string, collapsed: boolean, index: number) {
    const viewState = this.getViewState(viewId);
    viewState.collapsed = collapsed;
    let sizeIncrement: number;
    if (collapsed) {
      sizeIncrement = this.setSize(index, 0);
    } else {
      // 仅有一个视图展开时独占
      sizeIncrement = this.setSize(index, this.expandedViews.length === 1 ? this.getAvailableSize() : viewState.size || this.minSize);
    }
    // 下方视图被影响的情况下，上方视图不会同时变化
    let effected = false;
    // 从视图下方最后一个展开的视图起依次减去对应的高度
    for (let i = this.visibleViews.length - 1; i > index; i--) {
      if (this.getViewState(this.visibleViews[i].id).collapsed !== true) {
        sizeIncrement = this.setSize(i, sizeIncrement, true);
        effected = true;
        if (sizeIncrement === 0) {
          break;
        }
      }
    }
    if (!effected) {
      // 找到视图上方首个展开的视图减去对应的高度
      for (let i = index - 1; i >= 0; i--) {
        if ((this.state.get(this.visibleViews[i].id) || {}).collapsed !== true) {
          sizeIncrement = this.setSize(i, sizeIncrement, true);
          break;
        }
      }
    }
  }

  public getViewState(viewId: string) {
    let viewState = this.state.get(viewId);
    if (!viewState) {
      this.state.set(viewId, { collapsed: false, hidden: false });
      viewState = this.state.get(viewId)!;
    }
    return viewState;
  }

  protected setSize(index: number, targetSize: number, isIncrement?: boolean): number {
    const fullHeight = this.splitPanelService.rootNode.clientHeight;
    const panel = this.splitPanelService.panels[index];
    panel.classList.add('resize-ease');
    if (!targetSize) {
      targetSize = this.headerSize;
      panel.classList.add(RESIZE_LOCK);
    } else {
      panel.classList.remove(RESIZE_LOCK);
    }
    // clientHeight会被上次展开的元素挤掉
    const prevSize = panel.clientHeight;
    const viewState = this.getViewState(this.visibleViews[index].id);
    let calcTargetSize: number = targetSize;
    if (isIncrement) {
      calcTargetSize = Math.max(prevSize - targetSize, this.minSize);
      if (this.expandedViews.length > 1) {
        // 首其他视图展开/折叠影响的视图尺寸记录，仅有一个展开时不足记录
        viewState.size = calcTargetSize;
      }
    } else if (targetSize === this.headerSize && this.expandedViews.length > 0) {
      // 当前视图即将折叠且不是唯一展开的视图时，存储当前高度
      viewState.size = prevSize;
    }
    panel.style.height = calcTargetSize / fullHeight * 100 + '%';
    setTimeout(() => {
      // 动画 0.1s，保证结束后移除
      panel.classList.remove('resize-ease');
    }, 200);
    return isIncrement ? calcTargetSize - (prevSize - targetSize) : targetSize - prevSize;
  }

  protected getAvailableSize() {
    const fullHeight = this.splitPanelService.rootNode.clientHeight;
    return fullHeight - (this.visibleViews.length - 1) * this.headerSize;
  }

}

export const AccordionServiceFactory = Symbol('AccordionServiceFactory');
