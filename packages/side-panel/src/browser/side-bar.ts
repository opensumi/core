import { TabBar, Widget, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';
import { VirtualElement, VirtualDOM } from '@phosphor/virtualdom';
import { Message } from '@phosphor/messaging';

export class SideTabBar extends TabBar<Widget> {

  readonly tabAdded = new Signal<this, { title: Title<Widget> }>(this);

  onUpdateRequest() {
    this.renderTabs();
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

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.renderTabs();
  }
}
