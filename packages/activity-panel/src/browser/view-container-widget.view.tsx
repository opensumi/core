import { Injectable, INJECTOR_TOKEN, Injector, Autowired, Inject } from '@ali/common-di';
import { ActivityPanelToolbar } from './activity-panel-toolbar';
import { View, Side, AccordionWidget, CommandRegistry, SectionState, ContainerState, Deferred } from '@ali/ide-core-browser';
import { Widget, BoxPanel, BoxLayout, Title } from '@phosphor/widgets';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import { SECTION_HEADER_HEIGHT } from '@ali/ide-core-browser/lib/layout/accordion/section.view';

@Injectable({multiple: true})
export class ViewContainerWidget extends BoxPanel {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired()
  layoutState: LayoutState;

  titleBar: ActivityPanelToolbar;
  accordion: AccordionWidget;
  private lastState: ContainerState;

  constructor(
    public readonly containerId: string,
    protected readonly views: View[],
    protected readonly side: Side,
    public readonly command: string,
    public inVisible?: boolean,
    options?: BoxPanel.IOptions,
  ) {
    super({ direction: 'top-to-bottom', spacing: 0, ...options});
    this.init();
  }

  protected init() {
    this.titleBar = this.injector.get(ActivityPanelToolbar, [this.side, this.containerId]);
    this.accordion = this.injector.get(AccordionWidget, [this.containerId, this.views, this.side]);
    this.initContainer(this.accordion, this.containerId, this.titleBar);
  }

  protected initContainer(widget: Widget, containerId: string, titleBar?: Widget) {
    if (titleBar) {
      BoxPanel.setStretch(titleBar, 0);
      this.addWidget(titleBar);
    }
    BoxPanel.setStretch(widget, 1);
    this.addWidget(widget);
    this.addClass('side-container');
  }

  public updateTitleLabel() {
    this.titleBar.toolbarTitle = this.title;
    if (!this.title.label) {
      this.titleBar.hide();
    }
  }

  private showed = new Deferred();
  private partSizeRestored = false;

  protected onAfterShow() {
    if (this.partSizeRestored) { return; }
    this.showed.resolve();
    this.partSizeRestored = true;
  }

  async restoreState() {
    const {sections, orderedSections, containerLayout} = this.accordion;
    const defaultSections: SectionState[] = [];
    sections.forEach((section) => {
      const view = section.view;
      defaultSections.push({
        viewId: view.id,
        collapsed: view.collapsed || false,
        hidden: view.hidden || false,
        relativeSize: view.weight || 1,
      });
    });
    const defaultState = {
      sections: defaultSections,
    };
    // this.lastState = defaultState;
    this.lastState = this.layoutState.getState(LAYOUT_STATE.getContainerSpace(this.containerId), defaultState);
    for (const section of sections.values()) {
      const visibleSize = this.lastState.sections.filter((state) => !state.hidden).length;
      const sectionState = this.lastState.sections.find((stored) => stored.viewId === section.view.id);
      if (sections.size > 1 && sectionState) {
        if (section.view.forceHidden !== undefined) {
          section.setHidden(section.view.forceHidden);
        } else {
          section.setHidden(sectionState.hidden);
        }
        // restore的可视数量不超过1个时不折叠
        if (visibleSize > 1) {
          section.toggleOpen(sectionState.collapsed || !sectionState.relativeSize);
        }
      }
    }
    // this.updateTitleVisibility();
    setTimeout(() => {
      const relativeSizes: Array<number | undefined> = orderedSections.map((section) => {
        const storedState = this.lastState.sections.find((sectionState) => sectionState.viewId === section.id);
        if (storedState) {
          return storedState.relativeSize;
        }
        return section.view.priority;
      });
      // TODO 时序问题，同步执行relativeSizes没有生效
      if (this.isVisible) {
        containerLayout.setPartSizes(relativeSizes);
        this.partSizeRestored = true;
      } else {
        this.showed.promise.then(() => {
          // TODO 刚切换过来的时候视图还是乱的
          setTimeout(() => {
            containerLayout.setPartSizes(relativeSizes);
          }, 0);
        });
      }
      containerLayout.onLayoutUpdate(() => {
        this.storeState();
      });
    });
  }

  public storeState() {
    const {sections, containerLayout} = this.accordion;
    if (sections.size === 1) { return; }
    const availableSize = containerLayout.getAvailableSize();
    const state: ContainerState = {
      sections: [],
    };
    for (const section of sections.values()) {
      let size = containerLayout.getPartSize(section);
      if (size && size > SECTION_HEADER_HEIGHT) {
        size -= SECTION_HEADER_HEIGHT;
      }
      state.sections.push({
        viewId: section.view.id,
        collapsed: section.collapsed,
        hidden: section.isHidden,
        relativeSize: size && availableSize ? size / availableSize : undefined,
      });
    }
    this.layoutState.setState(LAYOUT_STATE.getContainerSpace(this.containerId), state);
    return state;
  }

  appendView(view: View, initialProps: any) {
    this.accordion.addWidget(view, initialProps);
  }

}
