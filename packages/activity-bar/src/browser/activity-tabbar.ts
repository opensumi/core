import { TabBar, Widget, Title } from '@phosphor/widgets';
import { ISignal, Signal } from '@phosphor/signaling';
import { h, VirtualElement } from '@phosphor/virtualdom';
import { Message } from '@phosphor/messaging';
import { ArrayExt } from '@phosphor/algorithm';
import { ElementExt } from '@phosphor/domutils';

class SideTabRender extends TabBar.Renderer {
  constructor() {
    super();
  }

  renderTab(data: TabBar.IRenderData<Widget>): VirtualElement {
    // @ts-ignore
    if (data.title.owner.inVisible) {
      return h.li();
    }
    return super.renderTab(data);
  }
  renderCloseIcon(data: TabBar.IRenderData<Widget>): VirtualElement {
    // TODO 类型优化
    // @ts-ignore
    if (data.title.badge && data.title.badge !== '0') {
      // @ts-ignore
      return h.div({ className: 'p-TabBar-tabBadge' }, data.title.badge);
    }
    return h.div({ className: 'p-TabBar-empty-badge' });
  }
}

export class ActivityTabBar extends TabBar<Widget> {
  constructor(options: TabBar.IOptions<Widget>, private side) {
    super(options);
  }

  public readonly collapseRequested = new Signal<this, Title<Widget>>(this);
  private mouseData?: {
    pressX: number,
    pressY: number,
    mouseDownTabIndex: number,
  };

  handleEvent(event: Event): void {
    switch (event.type) {
      case 'mousedown':
        this.onMouseDown(event as MouseEvent);
        super.handleEvent(event);
        break;
      case 'mouseup':
        super.handleEvent(event);
        this.onMouseUp(event as MouseEvent);
        break;
      default:
        super.handleEvent(event);
    }
  }
  private onMouseDown(event: MouseEvent): void {
    // Check for left mouse button and current mouse status
    if (event.button !== 0 || this.mouseData) {
      return;
    }

    // Check whether the mouse went down on the current tab
    const tabs = this.contentNode.children;
    const index = ArrayExt.findFirstIndex(tabs, (tab) => ElementExt.hitTest(tab, event.clientX, event.clientY));
    if (index < 0 || index !== this.currentIndex) {
      return;
    }

    // Check whether the close button was clicked
    const icon = tabs[index].querySelector(this.renderer.closeIconSelector);
    if (icon && icon.contains(event.target as HTMLElement)) {
      return;
    }

    this.mouseData = {
      pressX: event.clientX,
      pressY: event.clientY,
      mouseDownTabIndex: index,
    };
  }
  onMouseUp(event: MouseEvent) {
    if (event.button !== 0 || !this.mouseData) {
      return;
    }

    // Check whether the mouse went up on the current tab
    const mouseDownTabIndex = this.mouseData.mouseDownTabIndex;
    this.mouseData = undefined;
    const tabs = this.contentNode.children;
    const index = ArrayExt.findFirstIndex(tabs, (tab) => ElementExt.hitTest(tab, event.clientX, event.clientY));
    if (index < 0 || index !== mouseDownTabIndex) {
      return;
    }
    this.collapseRequested.emit(this.titles[index]);

  }

  renderer = this.side === 'bottom ' ? new SideTabRender() : new SideTabRender();
}
