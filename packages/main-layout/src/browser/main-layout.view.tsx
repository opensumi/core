import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import { SlotLocation } from '../common/main-layout-slot';
import { MainLayoutService } from './main-layout.service';

import {
  SplitPanel,
  Widget,
} from '@phosphor/widgets';
import { IdeWidget } from './ide-widget.view';

import './main-layout.less';

export const MainLayout = observer(() => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  const mainLayoutService = injector.get(MainLayoutService);

  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(function widgetsInit() {

    if (ref.current) {
      const menuBarWidget = injector.get(IdeWidget, [SlotLocation.menuBar, configContext]);

      const mainBoxLayout = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
      mainBoxLayout.id = 'main-box';
      const leftSlotWidget = injector.get(IdeWidget, [SlotLocation.leftPanel, configContext]);
      const middleWidget = new SplitPanel({orientation: 'vertical', spacing: 0});
      const topSlotWidget = injector.get(IdeWidget, [SlotLocation.topPanel, configContext]);
      const bottomSlotWidget = injector.get(IdeWidget, [SlotLocation.bottomPanel, configContext]);
      const rightSlotWidget = injector.get(IdeWidget, [SlotLocation.rightPanel, configContext]);
      const statusBarWidget = injector.get(IdeWidget, [SlotLocation.statusBar, configContext]);

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

      window.onresize = () => {
        mainBoxLayout.update();
        middleWidget.update();
      };

      return function destory() {
        window.onresize = null;
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
