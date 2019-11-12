import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { CtxMenu } from './ctx-menu/ctx-menu.view';
import { Dialog } from './dialog.view';
import { ComponentRenderer, ComponentRegistry, SlotLocation, useInjectable, ComponentRegistryInfo, AppConfig } from '@ali/ide-core-browser';

export const Overlay = observer(() => {
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);
  const extraComponents: React.FunctionComponent[] = [];
  const appConfig: AppConfig = useInjectable(AppConfig);
  if (appConfig.layoutConfig[SlotLocation.extra]) {
    appConfig.layoutConfig[SlotLocation.extra].modules.forEach((name) => {
      const info = componentRegistry.getComponentRegistryInfo(name);
      if (info) {
        (info.views || []).forEach((v) => {
          if (v.component) {
            extraComponents.push(v.component!);
          }
        });
      }
    });
  }

  return (
    <div className={'ide-overlay'}>
      <Dialog />
      <CtxMenu />
      <ComponentRenderer Component={extraComponents} />
    </div>
  );
});
