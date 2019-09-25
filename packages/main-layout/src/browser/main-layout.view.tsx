import * as React from 'react';
import { ConfigContext, useInjectable } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import './main-layout.less';
import { MainLayoutService } from './main-layout.service';
import { IMainLayoutService } from '../common';

export const MainLayout = observer(() => {
  const configContext = React.useContext(ConfigContext);

  const ref = React.useRef<HTMLElement | null>();
  const layoutService = useInjectable(IMainLayoutService) as MainLayoutService;

  React.useEffect(() => {

    if (ref.current) {
      layoutService.useConfig(configContext, ref.current);

      let windowResizeListener;
      let windowResizeTimer;
      window.addEventListener('resize', windowResizeListener = () => {
        windowResizeTimer = window.setTimeout(() => {
          clearTimeout(windowResizeTimer);
          layoutService.updateResizeWidget();
        }, 50);
      });

      layoutService.initedLayout();

      return function destory() {
        window.removeEventListener('resize', windowResizeListener);
        layoutService.destroy();
      };
    }
  }, [ref]);

  return (
    <div id='main-layout' ref={(ele) => ref.current = ele} />
  );
});
