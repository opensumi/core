import * as React from 'react';
import { Injectable, Autowired, Optinal, Inject, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { TabBar, Widget, SingletonLayout, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { ActivityTabBar } from './activity-tabbar';
import { Side } from './activity-bar.service';
import { ActivityPanelService } from '@ali/ide-activity-panel/lib/browser/activity-panel.service';
import { CommandService, DisposableCollection } from '@ali/ide-core-common';
import { MenuModelRegistry, ITabbarWidget, TabBarWidget } from '@ali/ide-core-browser';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';

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

  private previousWidget: Widget;

  currentChanged = new Signal<this, TabBarWidget.ICurrentChangedArgs>(this);

  onCollapse = new Signal<this, Title<Widget>>(this);

  inited = false;

  constructor(private side: Side, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.tabBar = new ActivityTabBar({ orientation: 'vertical', tabsMovable: true });
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

    const menuPath = ['TAB_BAR_CONTEXT_MENU'];
    const toDisposeOnHide = new DisposableCollection();
    for (const title of this.tabBar.titles) {
      const sideWrap = title.owner as any;
      toDisposeOnHide.push(this.menus.registerMenuAction([...menuPath], {
        label: `${sideWrap.inVisible ? '显示' : '隐藏'} ${title.label}`,
        commandId: sideWrap.command,
        // when: item.when,
      }));
    }
    this.contextMenuRenderer.render(
      menuPath,
      {x: event.clientX, y: event.clientY},
      () => toDisposeOnHide.dispose(),
    );
  }

  // 动画为Mainlayout slot能力，使用命令调用
  private async hidePanel() {
    await this.commandService.executeCommand(`main-layout.${this.side}-panel.hide`);
  }
  async showPanel(size?: number) {
    await this.commandService.executeCommand(`main-layout.${this.side}-panel.show`, size);
  }

  private async doCollapse(sender?: TabBar<Widget>, title?: Title<Widget>): Promise<void> {
    if (this.tabBar.currentTitle) {
      await this.hidePanel();
      this.tabBar.currentTitle = null;
      if (title) {
        this.onCollapse.emit(title);
        // TODO 修改位置收敛
        this.previousWidget = title.owner;
      }
    }
  }

  private async doOpen(previousWidget: Widget | null, currentWidget: Widget | null, size?: number) {
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
    }

    // 上次处于未展开状态，本次带动画展开
    if (currentWidget) {
      await this.showPanel(size);
    }

  }

  getWidget(index: number): Widget {
    return this.panelService.getWidgets(this.side)[index];
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

  private async _onCurrentChanged(sender: TabBar<Widget>, args: TabBar.ICurrentChangedArgs<Widget>): Promise<void> {
    // 首次insert时的onChange不触发，统一在refresh时设置激活
    if (!this.inited) {
      this.inited = true;
      this.currentWidget = null;
      return;
    }
    const { previousIndex, previousTitle, currentIndex, currentTitle } = args;

    const previousWidget = previousTitle ? previousTitle.owner : null;
    const currentWidget = currentTitle ? currentTitle.owner : null;

    if (!currentWidget) {
      if (previousWidget) {
        previousWidget.hide();
      }
      await this.hidePanel();
    } else {
      await this.doOpen(previousWidget, currentWidget);
    }

    this.currentChanged.emit({
      previousIndex, previousWidget, currentIndex, currentWidget,
    });
  }

}
