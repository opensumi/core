import * as React from 'react';
import { Injectable, Autowired, Optinal, Inject, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { TabBar, Widget, SingletonLayout } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { ActivatorTabBar } from './activator-tabbar';
import { ActivatorBarService, Side } from './activator-bar.service';
import { ActivatorPanelService } from '@ali/ide-activator-panel/lib/browser/activator-panel.service';

const WIDGET_OPTION = Symbol();

@Injectable({multiple: true})
export class ActivatorBarWidget extends Widget {

  readonly tabBar: ActivatorTabBar;

  // Service是单例的，作为left和right的manager
  @Autowired()
  private service!: ActivatorBarService;

  @Autowired()
  private panelService: ActivatorPanelService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  constructor(private side: Side, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.tabBar = new ActivatorTabBar({ orientation: 'vertical', tabsMovable: true });
    this.tabBar.addClass('p-TabPanel-tabBar');

    this.tabBar.currentChanged.connect(this._onCurrentChanged, this);
    this.tabBar.collapseRequested.connect(() => this.collapse(), this);

    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
    layout.widget = this.tabBar;
    this.layout = layout;

  }
  collapse(): void {
    if (this.tabBar.currentTitle) {
      // tslint:disable-next-line:no-null-keyword
      this.tabBar.currentTitle = null;
      this.service.hidePanel(this.side);
    }
  }

  getWidgets(side): ReadonlyArray<Widget> {
    return this.panelService.getWidgets(side);
  }
  addWidget(widget: Widget, side): void {
    const widgets = this.getWidgets(side);
    this.insertWidget(widgets.length, widget, side);
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

  private _currentChanged = new Signal<this, ActivatorBarWidget.ICurrentChangedArgs>(this);

  private _onCurrentChanged(sender: TabBar<Widget>, args: TabBar.ICurrentChangedArgs<Widget>): void {
    // Extract the previous and current title from the args.
    const { previousIndex, previousTitle, currentIndex, currentTitle } = args;

    // Extract the widgets from the titles.
    const previousWidget = previousTitle ? previousTitle.owner : null;
    const currentWidget = currentTitle ? currentTitle.owner : null;
    // Hide the previous widget.
    if (previousWidget) {
      previousWidget.hide();
    }

    // Show the current widget.
    if (currentWidget) {
      currentWidget.show();
      this.service.showPanel(this.side);
    }

    // Emit the `currentChanged` signal for the tab panel.
    this._currentChanged.emit({
      previousIndex, previousWidget, currentIndex, currentWidget,
    });

  }

}

// tslint:disable-next-line: no-namespace
export
namespace ActivatorBarWidget {
  /**
   * A type alias for tab placement in a tab bar.
   */
  export
  type TabPlacement = (
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
  export
  interface IOptions {
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
  export
  interface ICurrentChangedArgs {
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
