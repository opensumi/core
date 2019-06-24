import * as React from 'react';
import { ConfigContext, useInjectable } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import './main-layout.less';
import { MainLayoutShell } from './main-layout.shell';
import { MainLayoutService } from './main-layout.service';

export const MainLayout = observer(() => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  const ref = React.useRef<HTMLElement | null>();
  const layoutService = useInjectable(MainLayoutService);

  React.useEffect(() => {

    if (ref.current) {
      const mainLayoutShell = injector.get(MainLayoutShell);
      mainLayoutShell.useConfig(configContext, ref.current);

      let windowResizeListener;
      let windowResizeTimer;
      window.addEventListener('resize', windowResizeListener = () => {
        windowResizeTimer = window.setTimeout(() => {
          clearTimeout(windowResizeTimer);
          mainLayoutShell.updateResizeWidget();
        }, 50);
      });

      layoutService.initedLayout();

      return function destory() {
        window.removeEventListener('resize', windowResizeListener);
        mainLayoutShell.destroy();
      };
    }
  }, [ref]);

  return (
    <div id='main-layout' ref={(ele) => ref.current = ele} />
  );
});
