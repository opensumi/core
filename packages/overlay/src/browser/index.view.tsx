import { observer } from 'mobx-react-lite';
import React from 'react';

import {
  ComponentRenderer,
  ComponentRegistry,
  SlotLocation,
  useInjectable,
  AppConfig,
  IClientApp,
} from '@opensumi/ide-core-browser';

import { CtxMenu } from './ctx-menu/ctx-menu.view';
import { Dialog } from './dialog.view';
import './styles.module.less';

export const Overlay = observer(() => {
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);
  const clientApp = useInjectable(IClientApp);
  const [extraComponents, setExtra] = React.useState<React.ComponentType[]>([]);
  const appConfig: AppConfig = useInjectable(AppConfig);
  React.useEffect(() => {
    // 对于嵌套在模块视图的SlotRenderer，渲染时应用已启动
    clientApp.appInitialized.promise.then(() => {
      if (appConfig.layoutConfig[SlotLocation.extra]?.modules) {
        const components: React.ComponentType[] = [];
        appConfig.layoutConfig[SlotLocation.extra].modules.forEach((name) => {
          const info = componentRegistry.getComponentRegistryInfo(name);
          if (info) {
            (info.views || []).forEach((v) => {
              if (v.component) {
                components.push(v.component!);
              }
            });
          }
        });
        setExtra(components);
      }
    });
  }, []);

  return (
    <div id='ide-overlay' className='ide-overlay'>
      <Dialog />
      <CtxMenu />
      <ComponentRenderer Component={extraComponents} />
    </div>
  );
});
