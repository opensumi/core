import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject } from '@ali/common-di';
import { Widget, SplitPanel, PanelLayout } from '@phosphor/widgets';
import { ViewContainerSection, SECTION_HEADER_HEIGHT } from './section.view';
import { ViewContextKeyRegistry } from './view-context-key.registry';
import { IContextKeyService } from '../../context-key';
import { SplitPositionHandler } from '../split-panels';
import { AppConfig, MenuModelRegistry, CommandService, localize, Deferred, MenuAction, MenuPath } from '../../';
import { ViewUiStateManager } from './view-container-state';
import { LayoutState, LAYOUT_STATE } from '../layout-state';
import { ContextMenuRenderer } from '../../menu';
import { CommandRegistry } from '@ali/ide-core-common/lib/command';
import { Emitter, Event } from '@ali/ide-core-common';
import { View, measurePriority } from '..';
import { ViewContainerLayout } from './accordion.layout';
import { find } from '@phosphor/algorithm';
import { Message } from '@phosphor/messaging';

@Injectable({ multiple: true })
export class AccordionWidget extends Widget {
  public sections: Map<string, ViewContainerSection> = new Map<string, ViewContainerSection>();
  public orderedSections: Array<ViewContainerSection> = [];
  public showContainerIcons: boolean;
  public panel: SplitPanel;
  private lastState: ContainerState;

  @Autowired()
  private splitPositionHandler: SplitPositionHandler;

  @Autowired(AppConfig)
  configContext: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  uiStateManager: ViewUiStateManager;

  @Autowired()
  layoutState: LayoutState;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  @Autowired(MenuModelRegistry)
  menuRegistry: MenuModelRegistry;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  constructor(public containerId: string, protected views: View[], private side: 'left' | 'right' | 'bottom') {
    super();

    this.addClass('views-container');

    this.init();

    views.forEach((view: View) => {
      if (this.hasView(view.id)) {
        return;
      }
      this.appendSection(view, {});
    });
  }

  protected init() {
    const layout = new PanelLayout();
    this.layout = layout;
    this.panel = new SplitPanel({
      layout: new ViewContainerLayout({
        renderer: SplitPanel.defaultRenderer,
        orientation: 'vertical',
        spacing: 0,
        headerSize: 22,
        animationDuration: 100,
      }, this.splitPositionHandler),
    });
    this.panel.node.tabIndex = -1;
    layout.addWidget(this.panel);
    this.menuRegistry.registerMenuAction([...this.contextMenuPath, '0_global'], {
      commandId: this.registerGlobalHideCommand(),
      label: localize('view.hide', '隐藏'),
    });
  }

  private registerGlobalHideCommand() {
    const commandId = `view-container.hide.${this.containerId}`;
    this.commandRegistry.registerCommand({
      id: commandId,
    }, {
      execute: (anchor) => {
        const section = this.findSectionForAnchor(anchor);
        section!.setHidden(!section!.isHidden);
        this.updateTitleVisibility();
      },
    });
    return commandId;
  }

  protected findSectionForAnchor(anchor: { x: number, y: number }): ViewContainerSection | undefined {
    const element = document.elementFromPoint(anchor.x, anchor.y);
    if (element instanceof Element) {
      const closestPart = findClosestPart(element);
      if (closestPart && closestPart.id) {
        return find(this.containerLayout.iter(), (part) => part.id === closestPart.id);
      }
    }
    return undefined;
  }

  async restoreState() {
    const defaultSections: SectionState[] = [];
    this.sections.forEach((section) => {
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
    for (const section of this.sections.values()) {
      const visibleSize = this.lastState.sections.filter((state) => !state.hidden).length;
      const sectionState = this.lastState.sections.find((stored) => stored.viewId === section.view.id);
      if (this.sections.size > 1 && sectionState) {
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
    this.updateTitleVisibility();
    setTimeout(() => {
      const relativeSizes: Array<number | undefined> = this.orderedSections.map((section) => {
        const storedState = this.lastState.sections.find((sectionState) => sectionState.viewId === section.id);
        if (storedState) {
          return storedState.relativeSize;
        }
        return section.view.priority;
      });
      // TODO 时序问题，同步执行relativeSizes没有生效
      if (this.isVisible) {
        this.containerLayout.setPartSizes(relativeSizes);
        this.partSizeRestored = true;
      } else {
        this.showed.promise.then(() => {
          // TODO 刚切换过来的时候视图还是乱的
          setTimeout(() => {
            this.containerLayout.setPartSizes(relativeSizes);
          }, 0);
        });
      }
      this.containerLayout.onLayoutUpdate(() => {
        this.storeState();
      });
    }, 0);
  }

  private showed = new Deferred();
  private partSizeRestored = false;

  protected onAfterShow() {
    if (this.partSizeRestored) { return; }
    this.showed.resolve();
    this.partSizeRestored = true;
  }

  public storeState() {
    if (this.sections.size === 1) { return; }
    const availableSize = this.containerLayout.getAvailableSize();
    const state: ContainerState = {
      sections: [],
    };
    for (const section of this.sections.values()) {
      let size = this.containerLayout.getPartSize(section);
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

  get containerLayout(): ViewContainerLayout {
    return this.panel.layout as ViewContainerLayout;
  }

  public hasView(viewId: string): boolean {
    return this.sections.has(viewId);
  }

  public addWidget(view: View, props?: any) {
    const { id: viewId } = view;
    const section = this.sections.get(viewId);
    const contextKeyService = this.viewContextKeyRegistry.registerContextKeyService(viewId, this.contextKeyService.createScoped());
    contextKeyService.createKey('view', viewId);
    const viewState = this.uiStateManager.getState(viewId)!;
    if (section) {
      section.addViewComponent(view.component!, {
        ...(props || {}),
        viewState,
        key: viewId,
      });
    } else {
      this.appendSection(view, {
        ...(props || {}),
      });
    }
  }

  public removeWidget(viewId: string) {
    this.uiStateManager.removeState(viewId);
    const section = this.sections.get(viewId)!;
    this.containerLayout.removeWidget(section);
    this.sections.delete(viewId);
    this.refreshSection(viewId, section);
    section.dispose();
  }

  private viewVisibilityChange = new Emitter<string[]>();
  public onViewVisibilityChange = this.viewVisibilityChange.event;
  public updateTitleVisibility() {
    const visibleSections = this.getVisibleSections();
    if (visibleSections.length === 1) {
      visibleSections[0].hideTitle();
      visibleSections[0].toggleOpen(false);
    } else {
      visibleSections.forEach((section) => section.showTitle());
    }
    this.viewVisibilityChange.fire(visibleSections.map((section) => section.view.id));
  }

  public getVisibleSections() {
    const visibleSections: ViewContainerSection[] = [];
    this.sections.forEach((section) => {
      if (!section.isHidden) {
        visibleSections.push(section);
      }
    });
    return visibleSections;
  }

  private priorities: number[] = [];
  private appendSection(view: View, props: any) {
    this.uiStateManager.initSize(view.id, this.side);
    props.viewState = this.uiStateManager.getState(view.id)!;
    const section = this.injector.get(ViewContainerSection, [view, this.side, {props}]);
    this.sections.set(view.id, section);
    let insertIndex = this.orderedSections.findIndex((item) => {
      return (item.view.priority || 0) < (view.priority || 0);
    });
    if (insertIndex < 0) { insertIndex = this.orderedSections.length; }
    this.orderedSections.splice(insertIndex, 0, section);
    const index = measurePriority(this.priorities, view.priority);
    this.containerLayout.insertWidget(index, section);
    this.refreshSection(view.id, section);
    section.onCollapseChange(() => {
      this.containerLayout.updateCollapsed(section, true, () => {
        this.updateUiState(view.id, section.contentHeight);
      });
    });
    section.header.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.contextMenuRenderer.render(this.contextMenuPath, { x: event.clientX, y: event.clientY });
    });
  }

  protected refreshSection(viewId: string, section: ViewContainerSection) {
    this.updateTitleVisibility();
    setTimeout(() => {
      // FIXME 带动画resize导致的无法获取初始化高度
      this.updateUiState(viewId, section.contentHeight);
    }, 0);
    this.refreshMenu(section);
  }

  protected updateUiState(viewId: string, size: number) {
    if (!this.isVisible) {
      return;
    }
    this.uiStateManager.updateSize(viewId, size);
  }

  protected onResize(msg: Widget.ResizeMessage): void {
    super.onResize(msg);
    this.update();
  }

  onUpdateRequest(msg: Message) {
    super.onUpdateRequest(msg);
    this.sections.forEach((section: ViewContainerSection) => {
      if (!section.collapsed) {
        section.update();
      }
    });
  }

  registerToggleCommand(section: ViewContainerSection): string {
    const commandId = `view-container.toggle.${section.view.id}`;
    this.commandRegistry.registerCommand({
      id: commandId,
    }, {
      execute: () => {
        section.setHidden(!section.isHidden);
        this.updateTitleVisibility();
      },
      isToggled: () => !section.isHidden,
      isEnabled: () => {
        const visibleSections = this.getVisibleSections();
        if (visibleSections.length === 1 && visibleSections[0].view.id === section.view.id) {
          return false;
        }
        return true;
      },
    });
    return commandId;
  }

  getSections(): ViewContainerSection[] {
    return this.containerLayout.widgets;
  }

  /**
   * Register a menu action to toggle the visibility of the new part.
   * The menu action is unregistered first to enable refreshing the order of menu actions.
   */
  protected refreshMenu(section: ViewContainerSection): void {
    const commandId = this.registerToggleCommand(section);
    if (!section.view.name) {
      return;
    }
    const action: MenuAction = {
      commandId,
      label: section.view.name.toUpperCase(),
      order: this.getSections().indexOf(section).toString(),
    };
    this.menuRegistry.registerMenuAction([...this.contextMenuPath, '1_widgets'], action);
  }

  protected get contextMenuPath(): MenuPath {
    return [`${this.containerId}-context-menu`];
  }

}

export interface ViewContainerItem {
  id: string;
  title: string;
  icon: string;
}

export interface SectionState {
  viewId: string;
  collapsed: boolean;
  hidden: boolean;
  relativeSize?: number;
}

export interface ContainerState {
  sections: SectionState[];
}

export function findClosestPart(element: Element | EventTarget | null, selector: string = 'div.views-container-section'): Element | undefined {
  if (element instanceof Element) {
    const part = element.closest(selector);
    if (part instanceof Element) {
      return part;
    }
  }
  return undefined;
}
