import { TabBar, Widget, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { VirtualElement, VirtualDOM } from '@phosphor/virtualdom';
import { Message } from '@phosphor/messaging';
import { ArrayExt } from '@phosphor/algorithm';
import { ElementExt } from '@phosphor/domutils';

export class SideTabBar extends TabBar<Widget> {
  private static readonly DRAG_THRESHOLD = 5;

  readonly collapseRequested = new Signal<this, Title<Widget>>(this);
  readonly tabAdded = new Signal<this, { title: Title<Widget> }>(this);
  private pendingReveal?: Promise<void>;
  private mouseData?: {
    pressX: number,
    pressY: number,
    mouseDownTabIndex: number,
  };

  onUpdateRequest() {
    this.renderTabs();
  }

  insertTab(index: number, value: Title<Widget> | Title.IOptions<Widget>): Title<Widget> {
    const result = super.insertTab(index, value);
    this.tabAdded.emit({ title: result });
    return result;
  }

  renderTabs() {
    const titles = this.titles;
    const currentTitle = this.currentTitle;
    const n = titles.length;
    const content = new Array<VirtualElement>(n);
    for (let i = 0; i < n; i++) {
      const title = titles[i];
      const current = title === currentTitle;
      const zIndex = current ? n : n - i - 1;
      content[i] = this.renderer.renderTab({ title, zIndex, current });
    }
    VirtualDOM.render(content, this.contentNode);
  }

  /**
   * Reveal the tab with the given index by moving the scroll bar if necessary.
   */
  revealTab(index: number): Promise<void> {
    if (this.pendingReveal) {
      // A reveal has already been scheduled
      return this.pendingReveal;
    }
    const result = new Promise<void>((resolve, reject) => {
      // The tab might not have been created yet, so wait until the next frame
      window.requestAnimationFrame(() => {
        const tab = this.contentNode.children[index] as HTMLElement;
        if (tab && this.isVisible) {
          const parent = this.scrollbarHost;
          if (this.orientation === 'horizontal') {
            const scroll = parent.scrollLeft;
            const left = tab.offsetLeft;
            if (scroll > left) {
              parent.scrollLeft = left;
            } else {
              const right = left + tab.clientWidth - parent.clientWidth;
              if (scroll < right && tab.clientWidth < parent.clientWidth) {
                parent.scrollLeft = right;
              }
            }
          } else {
            const scroll = parent.scrollTop;
            const top = tab.offsetTop;
            if (scroll > top) {
              parent.scrollTop = top;
            } else {
              const bottom = top + tab.clientHeight - parent.clientHeight;
              if (scroll < bottom && tab.clientHeight < parent.clientHeight) {
                parent.scrollTop = bottom;
              }
            }
          }
        }
        if (this.pendingReveal === result) {
          this.pendingReveal = undefined;
        }
        resolve();
      });
    });
    this.pendingReveal = result;
    return result;
  }

  /**
   * The following event processing is used to generate `collapseRequested` signals
   * when the mouse goes up on the currently selected tab without too much movement
   * between `mousedown` and `mouseup`. The movement threshold is the same that
   * is used by the superclass to detect a drag event. The `allowDeselect` option
   * of the TabBar constructor cannot be used here because it is triggered when the
   * mouse goes down, and thus collides with dragging.
   */
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
      case 'mousemove':
        this.onMouseMove(event as MouseEvent);
        super.handleEvent(event);
        break;
      default:
        super.handleEvent(event);
    }
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.renderTabs();
  }

  protected get scrollbarHost(): HTMLElement {
    return this.node;
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

  private onMouseUp(event: MouseEvent): void {
    // Check for left mouse button and current mouse status
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
    // Collapse the side bar
    this.collapseRequested.emit(this.titles[index]);
  }

  private onMouseMove(event: MouseEvent): void {
    // Check for left mouse button and current mouse status
    if (event.button !== 0 || !this.mouseData) {
      return;
    }

    const data = this.mouseData;
    const dx = Math.abs(event.clientX - data.pressX);
    const dy = Math.abs(event.clientY - data.pressY);
    const threshold = SideTabBar.DRAG_THRESHOLD;
    if (dx >= threshold || dy >= threshold) {
      this.mouseData = undefined;
    }
  }
}
