import * as ReactDom from 'react-dom';
import * as React from 'react';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject } from '@ali/common-di';
import { Widget } from '@phosphor/widgets';
import { Emitter, Disposable, Event, DisposableCollection } from '@ali/ide-core-common';
import { View } from '..';
import { getIcon } from '../../icon';
import { ConfigProvider, SlotRenderer, AppConfig } from '../../react-providers';
import { LoadingView } from './loading-view.view';
import { ViewUiStateManager } from './view-container-state';
import { TabBarToolbar, TabBarToolbarRegistry } from './tab-bar-toolbar';
import './section.view.less';

export const SECTION_HEADER_HEIGHT = 22;
const COLLAPSED_CLASS = 'collapse';
const EXPANSION_TOGGLE_CLASS = 'expansion-collapse';

@Injectable({ multiple: true })
export class ViewContainerSection extends Widget implements ViewContainerPart {
  animatedSize?: number;
  uncollapsedSize?: number;

  node: HTMLDivElement;
  header: HTMLDivElement;
  control: HTMLDivElement;
  titleNode: HTMLDivElement;
  titleContainer: HTMLDivElement;
  content: HTMLDivElement;
  private uiStateManager: ViewUiStateManager;

  private toolBar: TabBarToolbar;

  protected readonly collapsedEmitter = new Emitter<boolean>();
  public onCollapseChange: Event<boolean> = this.collapsedEmitter.event;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  constructor(@Inject(Symbol()) public view: View, @Inject(Symbol()) private side: string, @Inject(Symbol()) private options) {
    super(options);
    this.addClass('views-container-section');
    this.createTitle();
    this.createContent();
    this.uiStateManager = this.injector.get(ViewUiStateManager);
    this.id = this.view.id;
  }

  get contentHeight() {
    return this.content.clientHeight;
  }

  get contentWidth() {
    return this.content.clientWidth;
  }

  set titleLabel(label: string) {
    this.title.label = label;
    this.titleNode.innerText = label;
  }

  onResize() {
    if (!this.collapsed) {
      this.uiStateManager.updateSize(this.view.id, this.contentHeight, this.contentWidth);
    }
  }

  createTitle(): void {
    this.header = createElement('views-container-section-title');
    this.header.style.height = SECTION_HEADER_HEIGHT + 'px';
    this.node.appendChild(this.header);

    this.control = createElement(EXPANSION_TOGGLE_CLASS);
    this.control.setAttribute('class', `${EXPANSION_TOGGLE_CLASS} ${getIcon('right')}`);

    this.titleNode = createElement('views-container-section-label');
    this.titleNode.innerText = this.view.name || this.view.id;

    this.titleContainer = createElement('views-container-section-wrap');
    this.titleContainer.appendChild(this.control);
    this.titleContainer.appendChild(this.titleNode);

    this.header.appendChild(this.titleContainer);

    this.createToolBar();
    this.header.appendChild(this.toolBar.node);

    this.header.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('action-icon')) {
        return;
      }

      // fixme: @寻壑 view 重构后需要去掉这个逻辑
      if (target.classList.contains('icon-ellipsis') || target.className.includes('iconAction__')) {
        return;
      }

      // hacky for scm/title
      this.toggleOpen();
    });
  }

  createToolBar(): void {
    this.toolBar = this.injector.get(TabBarToolbar, [this.view.id]);
  }

  protected updateToolbar(forceHide?: boolean): void {
    if (!this.toolBar || this.view.id.startsWith('scm')) {
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
    const Fc = this.view.component || LoadingView;
    ReactDom.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={Fc}  initialProps={{
          injector: this.configContext.injector,
          ...this.options.props,
        }}/>
      </ConfigProvider>, this.content);
  }

  get collapsed(): boolean {
    return this.control.classList.contains(COLLAPSED_CLASS);
  }

  get minSize(): number {
    const style = getComputedStyle(this.content);
    return parseCssMagnitude(style.minHeight, 0);
  }

  protected toDisposeOnOpen = new DisposableCollection();
  toggleOpen(hide?: boolean): void {
    const prevStatus = !this.collapsed;
    switch (hide) {
      case true:
        this.control.classList.add(COLLAPSED_CLASS);
        break;
      case false:
        this.control.classList.remove(COLLAPSED_CLASS);
        break;
      default:
        this.control.classList.toggle(COLLAPSED_CLASS);
    }
    if (!this.collapsed) {
      this.toDisposeOnOpen.dispose();
    } else {
      const display = this.content.style.display;
      this.content.style.display = 'none';
      this.toDisposeOnOpen.push(Disposable.create(() => this.content.style.display = display));
    }
    if (!this.collapsed !== prevStatus) {
      this.collapsedEmitter.fire(this.collapsed);
      this.update();
    }
  }

  addViewComponent(viewComponent: React.FunctionComponent, props: any = {}): void {
    ReactDom.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={viewComponent} initialProps={{
          injector: this.configContext.injector,
          ...props,
        }} />
      </ConfigProvider>, this.content);
    this.update();
  }

  onUpdateRequest() {
    if (!this.collapsed) {
      this.updateToolbar();
    } else {
      this.updateToolbar(true);
    }
  }

}

export interface ViewContainerPart extends Widget {
  minSize: number;
  animatedSize?: number;
  collapsed: boolean;
  uncollapsedSize?: number;
}

export function createElement(className?: string): HTMLDivElement {
  const div = document.createElement('div');
  if (className) {
    div.classList.add(className);
  }
  return div;
}
/**
 * Parse a magnitude value (e.g. width, height, left, top) from a CSS attribute value.
 * Returns the given default value (or undefined) if the value cannot be determined,
 * e.g. because it is a relative value like `50%` or `auto`.
 */
export function parseCssMagnitude(value: string | null, defaultValue: number): number;
export function parseCssMagnitude(value: string | null, defaultValue?: number): number | undefined {
  if (value) {
    let parsed: number;
    if (value.endsWith('px')) {
      parsed = parseFloat(value.substring(0, value.length - 2));
    } else {
      parsed = parseFloat(value);
    }
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}
