import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Widget, Title } from '@phosphor/widgets';
import { TabBarToolbar, TabBarToolbarRegistry } from './tab-bar-toolbar';
import { Message } from '@phosphor/messaging';
import { ViewsContainerWidget } from './views-container-widget';
import { View, ConfigProvider, AppConfig, SlotRenderer, MenuPath } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';

@Injectable({multiple: true})
export class ActivityPanelToolbar extends Widget {

  protected titleContainer: HTMLElement | undefined;
  protected titleComponentContainer: HTMLElement;
  private _toolbarTitle: Title<Widget> | undefined;
  private toolBarContainer: HTMLElement | undefined;

  @Autowired()
  protected readonly tabBarToolbarRegistry: TabBarToolbarRegistry;

  @Autowired()
  protected readonly toolbar: TabBarToolbar;

  @Autowired(AppConfig)
  protected readonly configContext: AppConfig;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  constructor(
    protected readonly side: 'left' | 'right' | 'bottom',
    protected readonly container: ViewsContainerWidget,
    private view?: View) {
    super();
    this.init();
    this.tabBarToolbarRegistry.onDidChange(() => this.update());
    this.node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.contextMenuRenderer.render(this.contextMenuPath, { x: event.clientX, y: event.clientY });
    });
  }

  protected get contextMenuPath(): MenuPath {
    return [`${this.container.containerId}-context-menu`, '1_widgets'];
  }

  protected onAfterAttach(msg: Message): void {
    if (this.toolbar) {
      if (this.toolbar.isAttached) {
        Widget.detach(this.toolbar);
      }
      const targetNode = this.toolBarContainer || this.node;
      Widget.attach(this.toolbar, targetNode);
      targetNode.appendChild(this.titleComponentContainer);
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
    const containerItems = this.tabBarToolbarRegistry.visibleItems(this.container.containerId);
    const currentVisibleView = this.side === 'bottom' ? this.view! : this.container.getVisibleView()[0];
    const items = widget && this.container.showContainerIcons ? this.tabBarToolbarRegistry.visibleItems(currentVisibleView.id).concat(containerItems) : containerItems;
    this.toolbar.updateItems(items, widget);
  }

  protected init(): void {
    this.titleContainer = document.createElement('div');
    this.titleContainer.classList.add('sidepanel-title');
    this.titleContainer.classList.add('noWrapInfo');
    this.node.appendChild(this.titleContainer);

    if (this.side === 'bottom') {
      this.toolBarContainer = document.createElement('div');
      this.toolBarContainer.classList.add('toolbar-container');
      this.node.appendChild(this.toolBarContainer);
    }
    // 自定义title组件容器
    this.titleComponentContainer = document.createElement('div');
    this.titleComponentContainer.classList.add('sidepanel-component');

    this.node.classList.add('sidepanel-toolbar');
    this.node.classList.add(`${this.side}-side-panel`);
    this.update();
  }

  set toolbarTitle(title: Title<Widget> | undefined) {
    if (this.titleContainer && title) {
      this._toolbarTitle = title;
      if (this._toolbarTitle.label) {
        this.titleContainer.innerHTML = this._toolbarTitle.label;
        this.update();
      } else {
        // title不传时隐藏标题栏
        this.titleContainer!.style.display = 'none';
      }
    }
  }

  // 对于debug等特殊模块，title底部自己实现
  public setComponent(Fc: React.FunctionComponent, size?: number) {
    if (size) {
      this.titleComponentContainer.style.height = size + 'px';
      this.node.style.minHeight = (35 + size) + 'px';
    }
    ReactDOM.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={Fc} />
      </ConfigProvider>
    , this.titleComponentContainer);
    this.container.update();
  }
}
