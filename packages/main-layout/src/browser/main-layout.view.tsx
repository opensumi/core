import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigContext, SlotRenderer } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import { SlotLocation } from '../common/main-layout-slot';

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
  const configContext = React.useContext<ConfigContext>(ConfigContext);
  const { slotMap } = configContext;

  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(function widgetsInit() {

    if (ref.current) {

      function createNodeBySlot(slotName: SlotLocation) {
        const widgetNode = document.createElement('div');
        if (slotMap.has(slotName)) {
          ReactDOM.render(
            <ConfigContext.Provider value={configContext}>
              <SlotRenderer name={slotName} />
            </ConfigContext.Provider>
          , widgetNode);
        }else{
          const bgColors = ['#f66', '#66f', '#6f6', '#ff6'];
          const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
          ReactDOM.render(<div style={{backgroundColor: bgColor, height: '100%'}}>${slotName}</div>, widgetNode);
        }
        return widgetNode;
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

      Widget.attach(menuBarWidget, ref.current);
      Widget.attach(mainBoxLayout, ref.current);
      Widget.attach(statusBarWidget, ref.current);

      return function destory() {
      };
    }
  }, [ref]);

  return (
    <div id='main' ref={(ele) => ref.current = ele} />
  );
});
