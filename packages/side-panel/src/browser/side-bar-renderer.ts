import { TabBar, Widget } from '@phosphor/widgets';
import { VirtualElement, h } from '@phosphor/virtualdom';
import { Injectable } from '@ali/common-di';

@Injectable()
export class TabBarRenderer extends TabBar.Renderer {

  tabBar?: TabBar<Widget>;

  constructor() {
    super();
  }

  renderTab(data: TabBar.IRenderData<Widget>): VirtualElement {
    return h.li(
      {
        key: data.title.caption, className: `fa ${data.title.iconClass}`, title: data.title.caption,
        style:
        {
          color: data.current ? '#D7DAE0' : '#9599A0',
        },
      },
    );
  }

}
