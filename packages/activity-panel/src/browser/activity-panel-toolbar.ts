// from theia
import { Widget, Title } from '@phosphor/widgets';
import { TabBarToolbar, TabBarToolbarRegistry } from './tab-bar-toolbar';
import { Message } from '@phosphor/messaging';
import { ViewsContainerWidget } from './views-container-widget';
import { View } from '@ali/ide-core-browser';

export class ActivityPanelToolbar extends Widget {

  protected titleContainer: HTMLElement | undefined;
  private _toolbarTitle: Title<Widget> | undefined;
  protected toolbar: TabBarToolbar | undefined;

  constructor(
    protected readonly tabBarToolbarRegistry: TabBarToolbarRegistry,
    protected readonly tabBarToolbarFactory: () => TabBarToolbar,
    protected readonly side: 'left' | 'right',
    protected readonly container: ViewsContainerWidget,
    protected readonly view: View) {
    super();
    this.init();
    this.tabBarToolbarRegistry.onDidChange(() => this.update());
  }

  protected onAfterAttach(msg: Message): void {
    if (this.toolbar) {
      if (this.toolbar.isAttached) {
        Widget.detach(this.toolbar);
      }
      Widget.attach(this.toolbar, this.node);
    }
    super.onAfterAttach(msg);
  }

  protected onBeforeDetach(msg: Message): void {
    if (this.titleContainer) {
      this.node.removeChild(this.titleContainer);
    }
    if (this.toolbar && this.toolbar.isAttached) {
      Widget.detach(this.toolbar);
    }
    super.onBeforeDetach(msg);
  }

  protected onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    this.updateToolbar();
  }

  protected updateToolbar(): void {
    if (!this.toolbar) {
      return;
    }
    const current = this._toolbarTitle;
    const widget = current && current.owner || undefined;
    const items = widget && this.container.showContainerIcons ? this.tabBarToolbarRegistry.visibleItems(this.view.id) : [];
    this.toolbar.updateItems(items, widget);
  }

  protected init(): void {
    this.titleContainer = document.createElement('div');
    this.titleContainer.classList.add('sidepanel-title');
    this.titleContainer.classList.add('noWrapInfo');
    this.node.appendChild(this.titleContainer);
    this.node.classList.add('sidepanel-toolbar');
    this.node.classList.add(`${this.side}-side-panel`);
    this.toolbar = this.tabBarToolbarFactory();
    this.update();
  }

  set toolbarTitle(title: Title<Widget> | undefined) {
    if (this.titleContainer && title) {
      this._toolbarTitle = title;
      this.titleContainer.innerHTML = this._toolbarTitle.label;
      this.update();
    }
  }
}
