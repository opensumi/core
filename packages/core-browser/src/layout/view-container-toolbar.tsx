import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Widget, Title } from '@phosphor/widgets';
import { Message } from '@phosphor/messaging';
import { View, ConfigProvider, AppConfig, SlotRenderer, MenuPath, TabBarToolbarRegistry, TabBarToolbar } from '../';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ViewContainerRegistry } from './view-container.registry';
import { ICtxMenuRenderer, IMenuRegistry, MenuService, generateCtxMenu } from '../menu/next';

@Injectable({multiple: true})
export class ActivityPanelToolbar extends Widget {

  protected outerWrap: HTMLElement;
  protected titleContainer: HTMLElement | undefined;
  protected titleComponentContainer: HTMLElement;
  private _toolbarTitle: Title<Widget> | undefined;
  private toolBarContainer: HTMLElement | undefined;

  @Autowired()
  protected readonly tabBarToolbarRegistry: TabBarToolbarRegistry;

  @Autowired(AppConfig)
  protected readonly configContext: AppConfig;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired(MenuService)
  private readonly menuService: MenuService;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  private toolbar: TabBarToolbar;

  constructor(
    protected readonly side: 'left' | 'right' | 'bottom',
    protected readonly containerId: string,
    private view?: View) {
    super();
    this.viewContainerRegistry.registerTitleBar(this.containerId, this);
    this.init();
    this.tabBarToolbarRegistry.onDidChange(() => this.update());
    this.node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menus = this.menuService.createMenu(this.contextMenuPath);
      // FIXME 需要支持自定义group的split吧? @伊北
      const menuNodes = generateCtxMenu({ menus });
      if (menuNodes[1].length > 3) {
        this.contextMenuRenderer.show({
          anchor: {x: event.clientX, y: event.clientY},
          // 临时支持，去掉global的隐藏及separator
          menuNodes: menuNodes[1].slice(2),
        });
      }
    });
    this.toolbar = this.injector.get(TabBarToolbar, [this.containerId, view && view.noToolbar]);
  }

  protected get contextMenuPath(): string {
    return `${this.containerId}-context-menu`;
  }

  protected onAfterAttach(msg: Message): void {
    if (this.toolbar) {
      if (this.toolbar.isAttached) {
        Widget.detach(this.toolbar);
      }
      Widget.attach(this.toolbar, this.toolBarContainer || this.outerWrap);
      (this.toolBarContainer || this.node).appendChild(this.titleComponentContainer);
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

  // 由外部调用决定
  public updateToolbar(viewId?: string): void {
    if (!this.toolbar || this.containerId.startsWith('scm')) {
      return;
    }
    const current = this._toolbarTitle;
    const widget = current && current.owner || undefined;
    const containerItems = this.tabBarToolbarRegistry.visibleItems(this.containerId);
    const items = widget && viewId ? this.tabBarToolbarRegistry.visibleItems(viewId).concat(containerItems) : containerItems;
    this.toolbar.updateItems(items, widget);
  }

  protected init(): void {
    this.outerWrap = document.createElement('div');
    if (this.side !== 'bottom') {
      this.outerWrap.classList.add('title-wrap');
    }
    this.titleContainer = document.createElement('div');
    this.titleContainer.classList.add('sidepanel-title');
    this.node.appendChild(this.outerWrap);
    this.outerWrap.appendChild(this.titleContainer);

    if (this.side === 'bottom') {
      this.toolBarContainer = document.createElement('div');
      this.toolBarContainer.classList.add('toolbar-container');
      this.node.appendChild(this.toolBarContainer);
    }
    // 自定义title组件容器
    this.titleComponentContainer = document.createElement('div');
    this.titleComponentContainer.classList.add('sidepanel-component');

    this.node.classList.add('panel-titlebar');
    this.node.classList.add(`${this.side}-panel-titlebar`);
    this.update();
  }

  set toolbarTitle(title: Title<Widget> | undefined) {
    if (this.titleContainer && title) {
      this._toolbarTitle = title;
      if (this._toolbarTitle.label) {
        this.titleContainer.innerHTML = this._toolbarTitle.label;
        // this.update();
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
  }
}
