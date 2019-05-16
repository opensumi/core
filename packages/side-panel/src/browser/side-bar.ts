import { TabBar, Widget, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { VirtualElement, VirtualDOM } from '@phosphor/virtualdom';
import { Message } from '@phosphor/messaging';

export class SideTabBar extends TabBar<Widget> {

  readonly tabAdded = new Signal<this, { title: Title<Widget> }>(this);
  private pendingReveal?: Promise<void>;

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

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.renderTabs();
  }

  protected get scrollbarHost(): HTMLElement {
    return this.node;
  }
}
