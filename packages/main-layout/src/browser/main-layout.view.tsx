import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import { SlotLocation } from '../common/main-layout-slot';
import { MainLayoutService } from './main-layout.service';
import {
  SplitPanel,
  Widget,
  BoxPanel,
  BoxLayout,
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
      // const mainLayoutBox = new BoxPanel({direction: 'top-to-bottom', spacing: 0});
      const menuBarWidget = injector.get(IdeWidget, [SlotLocation.menuBar, configContext]);
      menuBarWidget.id = 'menu-bar';

      const horizontalBoxLayout = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
      horizontalBoxLayout.id = 'main-box';
      const resizeLayout = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
      // const leftSlotWidget = injector.get(IdeWidget, [SlotLocation.leftPanel, configContext]);
      const activatorBarWidget = injector.get(IdeWidget, [SlotLocation.activatorBar, configContext]);
      activatorBarWidget.id = 'activator-bar';
      const activatorPanelWidget = injector.get(IdeWidget, [SlotLocation.activatorPanel, configContext]);

      const middleWidget = new SplitPanel({orientation: 'vertical', spacing: 0});
      const topSlotWidget = injector.get(IdeWidget, [SlotLocation.topPanel, configContext]);
      const bottomSlotWidget = injector.get(IdeWidget, [SlotLocation.bottomPanel, configContext]);
      const subsidiarySlotWidget = injector.get(IdeWidget, [SlotLocation.subsidiaryPanel, configContext]);
      const statusBarWidget = injector.get(IdeWidget, [SlotLocation.statusBar, configContext]);
      statusBarWidget.id = 'status-bar';

      // mainBoxLayout.addWidget(leftSlotWidget);
      resizeLayout.addWidget(activatorPanelWidget);
      middleWidget.addWidget(topSlotWidget);
      middleWidget.addWidget(bottomSlotWidget);
      resizeLayout.addWidget(middleWidget);
      resizeLayout.addWidget(subsidiarySlotWidget);

      resizeLayout.setRelativeSizes(mainLayoutService.horRelativeSizes.pop() || MainLayoutService.initHorRelativeSizes);
      middleWidget.setRelativeSizes(mainLayoutService.verRelativeSizes.pop() || MainLayoutService.initVerRelativeSizes);

      horizontalBoxLayout.addWidget(activatorBarWidget);
      horizontalBoxLayout.addWidget(resizeLayout);

      Widget.attach(menuBarWidget, ref.current);
      Widget.attach(horizontalBoxLayout, ref.current);
      Widget.attach(statusBarWidget, ref.current);

      /*
      mainLayoutBox.addWidget(menuBarWidget);
      mainLayoutBox.addWidget(horizontalBoxLayout);
      mainLayoutBox.addWidget(statusBarWidget);
      Widget.attach(mainLayoutBox, ref.current);
      */

      mainLayoutService.registerSlot(SlotLocation.subsidiaryPanel, subsidiarySlotWidget);
      mainLayoutService.registerSlot(SlotLocation.activatorPanel, activatorPanelWidget);
      mainLayoutService.registerSlot(SlotLocation.bottomPanel, bottomSlotWidget);
      mainLayoutService.resizeLayout = resizeLayout;
      mainLayoutService.middleLayout = middleWidget;

      let windowResizeListener;
      let windowResizeTimer;
      window.addEventListener('resize', windowResizeListener = () => {
        windowResizeTimer = window.setTimeout(() => {
          clearTimeout(windowResizeTimer);
          horizontalBoxLayout.update();
          middleWidget.update();
        }, 50);
      });

      return function destory() {
        window.removeEventListener('resize', windowResizeListener);
        Widget.detach(menuBarWidget);
        Widget.detach(horizontalBoxLayout);
        Widget.detach(statusBarWidget);
      };
    }
  }, [ref]);

  return (
    <div id='main-layout' ref={(ele) => ref.current = ele} />
  );
});
