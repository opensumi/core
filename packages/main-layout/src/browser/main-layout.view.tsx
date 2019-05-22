import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigContext, SlotRenderer, ConfigProvider, IEventBus } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import { SlotLocation } from '../common/main-layout-slot';
import { MainLayoutService } from './main-layout.service';

import {
  SplitPanel,
  Widget,
} from '@phosphor/widgets';
import { IdeWidget, ResizeEvent } from './ide-widget';

import './index.css';

export const MainLayout = observer(() => {
  const configContext = React.useContext(ConfigContext);
  const { slotMap, injector } = configContext;

  const mainLayoutService = injector.get(MainLayoutService);

  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(function widgetsInit() {

    if (ref.current) {

      function createNodeBySlot(slotName: SlotLocation) {
        const widgetNode = document.createElement('div');
        if (slotMap.has(slotName)) {
          ReactDOM.render(
            <ConfigProvider value={configContext}>
              <SlotRenderer name={slotName} />
            </ConfigProvider>
          , widgetNode);
        } else {
          const bgColors = ['#f66', '#66f', '#6f6', '#ff6'];
          const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
          ReactDOM.render(<div style={{backgroundColor: bgColor, height: '100%'}}>${slotName}</div>, widgetNode);
        }
        return widgetNode;
      }

      const menuBarWidget = injector.get(IdeWidget, [{
        node: createNodeBySlot(SlotLocation.menuBar),
      }]);

      const mainBoxLayout = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
      mainBoxLayout.id = 'main-box';

      const leftSlotWidget = injector.get(IdeWidget, [{
        node: createNodeBySlot(SlotLocation.leftPanel),
      }]);

      const middleWidget = new SplitPanel({orientation: 'vertical', spacing: 0});
      const topSlotWidget = injector.get(IdeWidget, [{
        node: createNodeBySlot(SlotLocation.topPanel),
      }]);
      const bottomSlotWidget = injector.get(IdeWidget, [{
        node: createNodeBySlot(SlotLocation.bottomPanel),
      }]);

      const rightSlotWidget = injector.get(IdeWidget, [{
        node: createNodeBySlot(SlotLocation.rightPanel),
      }]);

      const statusBarWidget = injector.get(IdeWidget, [{
        node: createNodeBySlot(SlotLocation.statusBar),
      }]);

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

      mainLayoutService.registerSlot(SlotLocation.rightPanel, rightSlotWidget);

      return function destory() {
        Widget.detach(menuBarWidget);
        Widget.detach(mainBoxLayout);
        Widget.detach(statusBarWidget);
      };
    }
  }, [ref]);

  return (
    <div id='main-layout' ref={(ele) => ref.current = ele} />
  );
});
