import * as React from 'react';
import { Injectable, Autowired, Optinal, Inject, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { TabBar, Widget, SingletonLayout, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { ActivatorTabBar } from './activator-tabbar';
import { Side } from './activator-bar.service';
import { ActivatorPanelService } from '@ali/ide-activator-panel/lib/browser/activator-panel.service';
import { CommandService } from '@ali/ide-core-node';

const WIDGET_OPTION = Symbol();

@Injectable({multiple: true})
export class ActivatorBarWidget extends Widget {

  readonly tabBar: ActivatorTabBar;

  @Autowired()
  private panelService: ActivatorPanelService;

  @Autowired(CommandService)
  private commandService!: CommandService;

  private previousWidget: Widget;

  currentChanged = new Signal<this, ActivatorBarWidget.ICurrentChangedArgs>(this);

  onCollapse = new Signal<this, Title<Widget>>(this);

  constructor(private side: Side, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.tabBar = new ActivatorTabBar({ orientation: 'vertical', tabsMovable: true });
    this.tabBar.addClass('p-TabPanel-tabBar');

    this.tabBar.currentChanged.connect(this._onCurrentChanged, this);
    this.tabBar.collapseRequested.connect(this.doCollapse, this);

    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
    layout.widget = this.tabBar;
    this.layout = layout;

  }

  // 动画为Mainlayout slot能力，使用命令调用
  async hidePanel() {
    await this.commandService.executeCommand(`main-layout.${this.side}-panel.hide`);
  }
  async showPanel() {
    await this.commandService.executeCommand(`main-layout.${this.side}-panel.show`);
  }

  async doCollapse(sender?: TabBar<Widget>, title?: Title<Widget>): Promise<void> {
    if (this.tabBar.currentTitle) {
      await this.hidePanel();
      this.tabBar.currentTitle = null;
      if (title) {
        this.onCollapse.emit(title);
        this.previousWidget = title.owner;
      }
    }
  }

  async doOpen(previousWidget: Widget | null, currentWidget: Widget | null) {
    if (!previousWidget && !currentWidget) {
      // 命令调用情况下，什么都不传，状态内部存储
      this.currentWidget = this.previousWidget;
    }

    if (previousWidget) {
      previousWidget.hide();
    }

    if (currentWidget) {
      this.previousWidget = currentWidget;
      currentWidget.show();
    }

    // 上次处于未展开状态，本次带动画展开
    if (!previousWidget && currentWidget) {
      await this.showPanel();
    }

  }

  getWidgets(): ReadonlyArray<Widget> {
    return this.panelService.getWidgets(this.side);
  }
  addWidget(widget: Widget, side: Side, index?: number): void {
    const widgets = this.getWidgets();
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
    const { previousIndex, previousTitle, currentIndex, currentTitle } = args;

    const previousWidget = previousTitle ? previousTitle.owner : null;
    const currentWidget = currentTitle ? currentTitle.owner : null;

    await this.doOpen(previousWidget, currentWidget);

    this.currentChanged.emit({
      previousIndex, previousWidget, currentIndex, currentWidget,
    });
  }

}

export namespace ActivatorBarWidget {
  /**
   * A type alias for tab placement in a tab bar.
   */
  export type TabPlacement = (
    /**
     * The tabs are placed as a row above the content.
     */
    'top' |

    /**
     * The tabs are placed as a column to the left of the content.
     */
    'left' |

    /**
     * The tabs are placed as a column to the right of the content.
     */
    'right' |

    /**
     * The tabs are placed as a row below the content.
     */
    'bottom'
  );

  /**
   * An options object for initializing a tab panel.
   */
  export interface IOptions {
    /**
     * Whether the tabs are movable by the user.
     *
     * The default is `false`.
     */
    tabsMovable?: boolean;

    /**
     * The placement of the tab bar relative to the content.
     *
     * The default is `'top'`.
     */
    tabPlacement?: TabPlacement;

    /**
     * The renderer for the panel's tab bar.
     *
     * The default is a shared renderer instance.
     */
    renderer?: TabBar.IRenderer<Widget>;
  }

  /**
   * The arguments object for the `currentChanged` signal.
   */
  export interface ICurrentChangedArgs {
    /**
     * The previously selected index.
     */
    previousIndex: number;

    /**
     * The previously selected widget.
     */
    previousWidget: Widget | null;

    /**
     * The currently selected index.
     */
    currentIndex: number;

    /**
     * The currently selected widget.
     */
    currentWidget: Widget | null;
  }
}
