import { Widget } from '@phosphor/widgets';
import { DisposableCollection, Disposable } from '@ali/ide-core-common';
import * as ReactDom from 'react-dom';
import * as React from 'react';
import { ConfigProvider, AppConfig, SlotRenderer, IContextKeyService } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';
import { LoadingView } from './loading-view.view';
import { View } from '@ali/ide-core-browser/lib/layout';
import { ViewUiStateManager } from './view-container-state';
import { TabBarToolbar, TabBarToolbarRegistry } from './tab-bar-toolbar';
import { ViewContextKeyRegistry } from './view-context-key.registry';

const COLLAPSED_CLASS = 'collapse';
const EXPANSION_TOGGLE_CLASS = 'expansion-collapse';

export interface ViewContainerItem {
  id: string | number;
  title: string;
  icon: string;
}

export function createElement(className?: string): HTMLDivElement {
  const div = document.createElement('div');
  if (className) {
    div.classList.add(className);
  }
  return div;
}

export class ViewsContainerWidget extends Widget {
  private sections: Map<string, ViewContainerSection> = new Map<string, ViewContainerSection>();
  private uiState: ViewUiStateManager;
  private viewContextKeyRegistry: ViewContextKeyRegistry;
  private contextKeyService: IContextKeyService;
  private cacheViewHeight: number;
  public showContainerIcons: boolean;

  constructor(protected viewContainer: ViewContainerItem, protected views: View[], private configContext: AppConfig, private injector: Injector, private side: 'left' | 'right') {
    super();

    this.id = `views-container-widget-${viewContainer.id}`;
    this.title.caption = this.title.label = viewContainer.title;
    this.addClass('views-container');

    this.uiState = this.injector.get(ViewUiStateManager);
    this.viewContextKeyRegistry = this.injector.get(ViewContextKeyRegistry);
    this.contextKeyService = this.injector.get(IContextKeyService);

    views.forEach((view: View) => {
      if (this.hasView(view.id)) {
        return;
      }
      this.appendSection(view);
    });
  }

  public hasView(viewId: string): boolean {
    return this.sections.has(viewId);
  }

  public addWidget(view: View, component: React.FunctionComponent, props?: any) {
    const { id: viewId } = view;
    const section = this.sections.get(viewId);
    const contextKeyService = this.viewContextKeyRegistry.registerContextKeyService(viewId, this.contextKeyService.createScoped());
    contextKeyService.createKey('view', viewId);
    if (section) {
      this.updateDimensions();
      const viewState = this.uiState.viewStateMap.get(viewId)!;
      section.addViewComponent(component, {
        ...(props || {}),
        viewState,
        key: viewId,
      });
    } else {
      this.appendSection(view);
    }
  }

  private appendSection(view: View) {
    const section = new ViewContainerSection(view, () => {
      this.updateDimensions();
    }, this.configContext, this.injector, this.side);
    this.sections.set(view.id, section);
    this.node.appendChild(section.node);
  }

  protected onResize(msg: Widget.ResizeMessage): void {
    super.onResize(msg);
    this.updateDimensions();
  }

  public updateDimensions() {
    let visibleSections = 0;
    let availableHeight = this.node.offsetHeight;
    if (availableHeight && availableHeight !== this.cacheViewHeight) {
      this.cacheViewHeight = availableHeight;
    }
    if (this.sections.size === 1) {
      const section = this.sections.values().next().value;
      section.hideTitle();
      this.showContainerIcons = true;
    } else {
      this.sections.forEach((section) => section.showTitle());
      this.showContainerIcons = false;
    }
    // Determine available space for sections and how much sections are opened
    this.sections.forEach((section: ViewContainerSection) => {
      availableHeight -= section.header.offsetHeight;
      if (section.opened) {
        visibleSections++;
      }
    });
    // Do nothing if there is no opened sections
    if (visibleSections === 0) {
      return;
    }
    // Get section height
    const sectionHeight = availableHeight / visibleSections;
    // Update height of opened sections
    this.sections.forEach((section: ViewContainerSection) => {
      if (section.opened) {
        section.content.style.height = `${sectionHeight}px`;
        section.update();
      }
    });
  }

}

export class ViewContainerSection {
  node: HTMLDivElement;
  header: HTMLDivElement;
  control: HTMLDivElement;
  title: HTMLDivElement;
  content: HTMLDivElement;
  private uiState: ViewUiStateManager;
  private toolBar: TabBarToolbar;

  private viewComponent: React.FunctionComponent;

  constructor(public view: View, private updateDimensionsCallback: () => any, private configContext: AppConfig, private injector: Injector, private side: string) {
    this.node = createElement('views-container-section');
    this.createToolBar();
    this.createTitle();
    this.createContent();
    this.updateDimensionsCallback();
    this.uiState = this.injector.get(ViewUiStateManager);
    this.uiState.initSize(view.id, this.side);
  }

  createTitle(): void {
    this.header = createElement('views-container-section-title');
    this.node.appendChild(this.header);

    this.control = createElement(EXPANSION_TOGGLE_CLASS);
    this.header.appendChild(this.control);

    this.title = createElement('views-container-section-label');
    this.title.innerText = this.view.name || this.view.id;
    this.header.appendChild(this.title);
    this.header.appendChild(this.toolBar.node);

    this.header.addEventListener('click', (event) => {
      if (!(event.target as HTMLElement).classList.contains('action-icon')) {
        this.toggleOpen();
      }
    });
  }

  createToolBar(): void {
    this.toolBar = this.injector.get(TabBarToolbar);
  }

  protected updateToolbar(forceHide?: boolean): void {
    if (!this.toolBar) {
      return;
    }
    const tabBarToolbarRegistry = this.injector.get(TabBarToolbarRegistry);
    const items = forceHide ? [] : tabBarToolbarRegistry.visibleItems(this.view.id);
    this.toolBar.updateItems(items, undefined);
  }

  hideTitle(): void {
    this.header.classList.add('p-mod-hidden');
  }

  showTitle(): void {
    this.header.classList.remove('p-mod-hidden');
  }

  createContent(): void {
    this.content = createElement('views-container-section-content');
    this.node.appendChild(this.content);
    ReactDom.render(
    <ConfigProvider value={this.configContext} >
      <SlotRenderer Component={LoadingView} />
    </ConfigProvider>, this.content);
  }

  get opened(): boolean {
    const opened = !this.control.classList.contains(COLLAPSED_CLASS);
    this.uiState.updateOpened(this.view.id, opened);
    return opened;
  }

  protected toDisposeOnOpen = new DisposableCollection();
  toggleOpen(): void {
    this.control.classList.toggle(COLLAPSED_CLASS);
    if (this.opened) {
      this.toDisposeOnOpen.dispose();
    } else {
      const display = this.content.style.display;
      this.content.style.display = 'none';
      this.toDisposeOnOpen.push(Disposable.create(() => this.content.style.display = display));
    }
    this.updateDimensionsCallback();
    this.update();
  }

  addViewComponent(viewComponent: React.FunctionComponent, props: any = {}): void {
    this.viewComponent = viewComponent;
    ReactDom.unmountComponentAtNode(this.content);
    ReactDom.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={viewComponent} initialProps={{
          injector: this.configContext.injector,
          ...props,
        }}/>
      </ConfigProvider>, this.content);
    this.update();
  }

  update(): void {
    if (this.opened && this.viewComponent) {
      const height = this.content.clientHeight;
      this.uiState.updateSize(this.view.id, height);
      this.updateToolbar();
    } else {
      this.updateToolbar(true);
    }
  }
}
