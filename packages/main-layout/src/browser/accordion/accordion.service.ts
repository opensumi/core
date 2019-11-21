import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { View } from '@ali/ide-core-browser';
import { action, observable } from 'mobx';
import { SplitPanelManager, SplitPanelService } from '@ali/ide-core-browser/lib/components/layout/split-panel.service';

export interface SectionState {
  collapsed: boolean;
  hidden: boolean;
  size?: number;
}

const HEADER_SIZE = 22;
const MIN_SECTION_HEIGHT = 120;

@Injectable({multiple: true})
export class AccordionService {
  @Autowired()
  splitPanelManager: SplitPanelManager;

  splitPanelService: SplitPanelService;

  views: View[];

  @observable state: Map<string, SectionState> = new Map();

  constructor(public containerId: string) {
    this.splitPanelService = this.splitPanelManager.getService(containerId);
  }

  initViews(views: View[]) {
    this.views = views.sort((prev, next) => (prev.priority || 0) - (next.priority || 0));
  }

  appendView(view: View) {
    const index = this.views.findIndex((value) => (value.priority || 0) <= (view.priority || 0));
    this.views.splice(index, 0, view);
  }

  get visibleViews(): View[] {
    return this.views.filter((view) => {
      const viewState = this.state.get(view.id);
      return !viewState || viewState && !viewState.hidden;
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
      sizeIncrement = this.setSize(index, this.expandedViews.length === 1 ? this.getAvailableSize() : viewState.size || MIN_SECTION_HEIGHT);
    }
    // 找到视图下方首个展开的视图减去对应的高度
    for (let i = this.views.length - 1; i > index; i--) {
      if ((this.state.get(this.views[i].id) || {}).collapsed !== true) {
        this.setSize(i, sizeIncrement, true);
        break;
      }
    }
    // 找到视图上方首个展开的视图增加对应的高度
    for (let i = index - 1; i >= 0; i--) {
      if ((this.state.get(this.views[i].id) || {}).collapsed !== true) {
        this.setSize(i, sizeIncrement, true);
        break;
      }
    }
  }

  protected getViewState(viewId: string) {
    let viewState = this.state.get(viewId);
    if (!viewState) {
      this.state.set(viewId, { collapsed: false, hidden: false });
      viewState = this.state.get(viewId)!;
    }
    return viewState;
  }

  protected setSize(index: number, targetSize: number, isIncrement?: boolean): number {
    if (!targetSize) {
      targetSize = HEADER_SIZE;
    }
    const fullHeight = this.splitPanelService.rootNode.clientHeight;
    const panel = this.splitPanelService.panels[index];
    // clientHeight会被上次展开的元素挤掉
    const prevSize = (+panel.style.height!.replace('%', '')) / 100 * fullHeight;
    const viewState = this.getViewState(this.views[index].id);
    if (isIncrement && this.expandedViews.length > 1) {
      // 首其他视图展开/折叠影响的视图尺寸记录，仅有一个展开时不足记录
      viewState.size = targetSize + prevSize;
    } else if (targetSize === HEADER_SIZE && this.expandedViews.length > 0) {
      // 当前视图即将折叠且不是唯一展开的视图时，存储当前高度
      viewState.size = prevSize;
    }
    panel.style.height = (isIncrement ? targetSize + prevSize : targetSize) / fullHeight * 100 + '%';
    return isIncrement ? targetSize : prevSize - targetSize;
  }

  protected getAvailableSize() {
    const fullHeight = this.splitPanelService.rootNode.clientHeight;
    return fullHeight - (this.views.length - 1) * HEADER_SIZE;
  }

}

export const AccordionServiceFactory = Symbol('AccordionServiceFactory');
