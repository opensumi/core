import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { IEventBus } from '@ali/ide-core-common';
import { Widget, SingletonLayout, DockPanel, TabBar, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { TabBarWidget, ITabbarWidget } from '@ali/ide-core-browser';

const WIDGET_OPTION = Symbol();
@Injectable()
export class BottomDockPanelWidget extends Widget implements ITabbarWidget {
  constructor(@Optinal(WIDGET_OPTION) options) {
    super(options);
    this.dockPanel = new BottomDockPanel({ mode: 'single-document' });
    this.tabBar = this.dockPanel.tabBars().next()!;
    this.tabBar.currentChanged.connect(this.handleCurrentChange, this);

    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
    layout.widget = this.tabBar;
    this.layout = layout;
  }
  public dockPanel: BottomDockPanel;

  // 只能使用single-document模式，不支持多个tabBar
  tabBar: TabBar<Widget>;

  currentChanged = new Signal<this, TabBarWidget.ICurrentChangedArgs>(this);

  onCollapse = new Signal<this, Title<Widget>>(this);

  showPanel() {
    // TODO implement 手动展示，与mainlayout关联
  }

  get currentWidget() {
    const title = this.tabBar.currentTitle;
    return title ? title.owner : null;
  }

  private async handleCurrentChange(sender: TabBar<Widget>, args: TabBar.ICurrentChangedArgs<Widget>): Promise<void> {
    // TODO 切换逻辑，currentChanged，onCollapse实现
    console.log(args);
  }

  addWidget(widget: Widget, side: string, index?: number) {
    this.dockPanel.addWidget(widget, {
      // TODO 实现insert index（通过ref+tab-after）
    });
  }

  getWidget(index: number) {
    const iter = this.dockPanel.widgets();
    while (index-- > 0) {
      iter.next();
    }
    return iter.next()!;
  }
}

export class BottomDockPanel extends DockPanel {

}
