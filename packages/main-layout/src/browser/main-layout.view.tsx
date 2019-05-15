import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigContext } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import { SlotLocation } from '../common/main-layout-slot';

import {
  CommandRegistry,
} from '@phosphor/commands';

import {
  Message,
} from '@phosphor/messaging';

import {
  BoxPanel,
  SplitLayout,
  SplitPanel,
  CommandPalette,
  ContextMenu,
  DockPanel,
  Menu,
  MenuBar,
  Widget,
  TabPanel,
  TabBar,
  StackedPanel,
  BoxLayout,
} from '@phosphor/widgets';

import './index.css';

export const MainLayout = observer(() => {
  const { slotMap } = React.useContext(ConfigContext);

  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(function widgetsInit() {

    if (ref.current) {

      function createNodeBySlot(renderName: SlotLocation) {
        const $container = document.createElement('div');
        const Component = slotMap.get(renderName);
        if (!Component) {
          const bgColors = ['#f66', '#66f', '#6f6', '#ff6'];
          const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];

          ReactDOM.render(<div style={{backgroundColor: bgColor, height: '100%'}}>${renderName}</div>, $container);
          return $container;
        }
        ReactDOM.render(<Component />, $container);
        return $container;
      }

      const menuBarWidget = new Widget({
        node: createNodeBySlot(SlotLocation.menuBar),
      });

      const mainBoxLayout = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
      mainBoxLayout.id = 'main-layout';

      const leftSlotWidget = new Widget({
        node: createNodeBySlot(SlotLocation.leftPanel),
      });

      const middleWidget = new SplitPanel({orientation: 'vertical', spacing: 0});
      const topSlotWidget = new Widget({
        node: createNodeBySlot(SlotLocation.topPanel),
      });
      const bottomSlotWidget = new Widget({
        node: createNodeBySlot(SlotLocation.bottomPanel),
      });

      const rightSlotWidget = new Widget({
        node: createNodeBySlot(SlotLocation.rightPanel),
      });

      const statusBarWidget = new Widget({
        node: createNodeBySlot(SlotLocation.statusBar),
      });

      mainBoxLayout.addWidget(leftSlotWidget);

      middleWidget.addWidget(topSlotWidget);
      middleWidget.addWidget(bottomSlotWidget);
      mainBoxLayout.addWidget(middleWidget);
      mainBoxLayout.addWidget(rightSlotWidget);

      mainBoxLayout.setRelativeSizes([1, 3, 1]);
      middleWidget.setRelativeSizes([3, 1]);

      Widget.attach(menuBarWidget, document.body);
      Widget.attach(mainBoxLayout, document.body);
      Widget.attach(statusBarWidget, document.body);

      return function destory() {
        // ReactDOM.unmountComponentAtNode($container)
      };
    }
  }, [ref]);

  return (
    <div ref={(ele) => ref.current = ele} />
  );
});
