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
        key: data.title.caption, className: data.title.iconClass, title: data.title.caption,
        style:
        {
          width: '50px', height: '50px', lineHeight: '50px',
          textAlign: 'center', backgroundColor: data.current ? '#ccc' : '#f2f2f2',
        },
      },
      h.div({ className: 'p-TabBar-tabLabel' }, data.title.label),
    );
  }

}
