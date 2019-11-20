import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { View } from '@ali/ide-core-browser';
import { action, observable } from 'mobx';

export interface SectionState {
  collapsed: boolean;
  hidden: boolean;
  size?: number;
}

const HEADER_SIZE = 22;

@Injectable({multiple: true})
export class AccordionService {
  views: View[];

  @observable state: Map<string, SectionState> = new Map();

  constructor(public containerId: string) {}

  initViews(views: View[]) {
    this.views = views.sort((prev, next) => (prev.priority || 0) - (next.priority || 0));
  }

  appendView(view: View) {
    const index = this.views.findIndex((value) => (value.priority || 0) <= (view.priority || 0));
    this.views.splice(index, 0, view);
  }

  @action.bound handleSectionClick(viewId: string, collapsed: boolean, index: number, currentSize: number, setSize: (targetSize: number) => void) {
    let viewState = this.state.get(viewId);
    if (!viewState) {
      this.state.set(viewId, { collapsed, hidden: false });
      viewState = this.state.get(viewId)!;
    } else {
      viewState.collapsed = collapsed;
    }
    if (currentSize !== HEADER_SIZE) {
      viewState.size = currentSize;
    }
    if (collapsed) {
      setSize(HEADER_SIZE);
    } else {
      setSize(viewState.size || 400);
    }
  }
}

export const AccordionServiceFactory = Symbol('AccordionServiceFactory');
