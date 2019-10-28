import * as React from 'react';
import { Injectable, Autowired, Optinal, Inject, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { TabBar, Widget, SingletonLayout, Title, BoxPanel } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { ActivityTabBar } from './activity-tabbar';
import { ActivityPanelService } from '@ali/ide-activity-panel/lib/browser/activity-panel.service';
import { CommandService, DisposableCollection } from '@ali/ide-core-common';
import { MenuModelRegistry, ITabbarWidget, TabBarWidget, Side, AccordionWidget } from '@ali/ide-core-browser';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ActivationEventService } from '@ali/ide-activation-event';
import { SIDE_MENU_PATH } from '../common';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';

const WIDGET_OPTION = Symbol();

@Injectable({multiple: true})
export class ActivityBarWidget extends Widget implements ITabbarWidget {

  readonly tabBar: ActivityTabBar;

  @Autowired()
  private panelService: ActivityPanelService;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  @Autowired(MenuModelRegistry)
  menus: MenuModelRegistry;

  @Autowired()
  activationEventService: ActivationEventService;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  private previousWidget: Widget;

  currentChanged = new Signal<this, TabBarWidget.ICurrentChangedArgs>(this);

  onCollapse = new Signal<this, Title<Widget>>(this);

  inited = false;

  private expanded = false;

  private _toDispose: DisposableCollection | undefined;

  constructor(private side: Side, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.tabBar = new ActivityTabBar({
      orientation: this.side === 'bottom' ? 'horizontal' : 'vertical',
      tabsMovable: true,
      insertBehavior: 'none',
    }, side);
    this.tabBar.addClass('p-TabPanel-tabBar');

    this.tabBar.currentChanged.connect(this._onCurrentChanged, this);
    this.tabBar.collapseRequested.connect(this.doCollapse, this);

    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
    layout.widget = this.tabBar;
    this.layout = layout;

    this.node.oncontextmenu = (e) => {
      this.handleContextMenu(e);
    };
  }

  private handleContextMenu(event: MouseEvent) {
    event.preventDefault();

    if (this._toDispose) {
      this._toDispose.dispose();
    }
    this._toDispose = new DisposableCollection();
    for (const title of this.tabBar.titles) {
      const sideWrap = title.owner as any;
      this._toDispose.push(this.menus.registerMenuAction([`${SIDE_MENU_PATH}/${this.side}`, '1_widgets'], {
        label: (title.label || '').toUpperCase(),
        commandId: sideWrap.command,
      }));
    }
    this.contextMenuRenderer.render(
      [`${SIDE_MENU_PATH}/${this.side}`],
      {x: event.clientX, y: event.clientY},
    );
  }

  // 动画为Mainlayout slot能力，使用命令调用
  async hidePanel() {
    await this.commandService.executeCommand(`main-layout.${this.side}-panel.hide`);
  }
  async showPanel(size?: number) {
    await this.commandService.executeCommand(`main-layout.${this.side}-panel.show`, size);
  }

  async doCollapse(sender?: TabBar<Widget>, title?: Title<Widget>): Promise<void> {
    if (this.side === 'bottom') {
      return;
    }
    if (this.tabBar.currentTitle) {
      this.tabBar.currentTitle = null;
      if (title) {
        this.onCollapse.emit(title);
        this.previousWidget = title.owner;
      }
    }
  }

  async doOpen(previousWidget: Widget | null, currentWidget: Widget | null, size?: number) {
    if (!previousWidget && !currentWidget) {
      // 命令调用情况下，什么都不传，状态内部存储（previousWidget初始值为null）
      return this.currentWidget = this.previousWidget || this.tabBar.titles[0].owner;
    }

    if (previousWidget) {
      previousWidget.hide();
    }

    if (currentWidget) {
      this.previousWidget = currentWidget;
      currentWidget.show();
      await this.showPanel(size);
      // 从expanded切换时reset expand状态
      if (!size || size < 9999 && this.expanded) {
        this.expanded = false;
      }
    }

  }

  getWidget(indexOrId: number | string): Widget {
    if (typeof indexOrId === 'number') {
      return this.panelService.getWidgets(this.side)[indexOrId];
    }
    return this.tabBar.titles.find((title) => (title.owner as any).containerId === indexOrId)!.owner;
  }
  addWidget(widget: Widget, side: Side, index?: number): void {
    const widgets = this.panelService.getWidgets(side);
    this.insertWidget(index === undefined ? widgets.length : index, widget, side);
  }
  private insertWidget(index: number, widget: Widget, side): void {
    if (widget !== this.currentWidget) {
      widget.hide();
    }
    this.panelService.insertWidget(index, widget, side);
    this.tabBar.insertTab(index, widget.title);
  }
  get currentWidget(): Widget | null {
    const title = this.tabBar.currentTitle;
    return title ? title.owner : null;
  }

  set currentWidget(widget: Widget | null) {
    if (widget) {
      this.previousWidget = widget;
    }
    this.tabBar.currentTitle = widget ? widget.title : null;
  }

  protected async _onCurrentChanged(sender: TabBar<Widget>, args: TabBar.ICurrentChangedArgs<Widget>): Promise<void> {
    const { previousIndex, previousTitle, currentIndex, currentTitle } = args;

    const previousWidget = previousTitle ? previousTitle.owner : null;
    const currentWidget = currentTitle ? currentTitle.owner : null;

    if (this.side !== 'bottom') {
      if (!currentWidget) {
        if (previousWidget) {
          previousWidget.hide();
        }
        await this.hidePanel();
      } else {
        const expandSize = currentTitle && currentTitle.owner.hasClass('expanded') ? 9999 : undefined;
        if (expandSize) {
          this.expanded = true;
        }
        await this.doOpen(previousWidget, currentWidget, expandSize);
        const currentId = (currentWidget as any).containerId;
        const accordion = this.viewContainerRegistry.getAccordion(currentId);
        // 不使用view container的情况（业务组件）
        if (accordion) {
          for (const section of accordion.sections.values()) {
            this.activationEventService.fireEvent('onView', section.view.id);
          }
        }
      }
    } else {
      if (currentWidget) {
        currentWidget.show();
      }
      if (previousWidget) {
        previousWidget.hide();
      }
    }

    this.currentChanged.emit({
      previousIndex, previousWidget, currentIndex, currentWidget,
    });
  }

}
