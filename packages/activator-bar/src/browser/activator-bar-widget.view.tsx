import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SlotRenderer, ConfigProvider, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired, Optinal, Inject } from '@ali/common-di';
import { IEventBus, BasicEvent } from '@ali/ide-core-common';
import { BoxLayout, TabBar, Widget, SingletonLayout } from '@phosphor/widgets';
import { ActivatorPanelWidget } from '@ali/ide-activator-panel/lib/browser/activator-panel-widget.view';
import { ISignal, Signal } from '@phosphor/signaling';

const WIDGET_OPTION = Symbol();

@Injectable()
export class ActivatorBarWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;

  @Autowired()
  private activatorPanelWidget!: ActivatorPanelWidget;

  constructor(@Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.tabBar = new TabBar<Widget>({ orientation: 'vertical', tabsMovable: true });
    this.tabBar.addClass('p-TabPanel-tabBar');

    this.tabBar.currentChanged.connect(this._onCurrentChanged, this);

    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
    layout.widget = this.tabBar;
    this.layout = layout;
  }

  get widgets(): ReadonlyArray<Widget> {
    return this.activatorPanelWidget.stackedPanel.widgets;
  }
  addWidget(widget: Widget): void {
    this.insertWidget(this.widgets.length, widget);
  }
  insertWidget(index: number, widget: Widget): void {
    if (widget !== this.currentWidget) {
      widget.hide();
    }
    this.activatorPanelWidget.stackedPanel.insertWidget(index, widget);
    this.tabBar.insertTab(index, widget.title);
  }
  get currentWidget(): Widget | null {
    const title = this.tabBar.currentTitle;
    return title ? title.owner : null;
  }

  readonly tabBar: TabBar<Widget>;

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
