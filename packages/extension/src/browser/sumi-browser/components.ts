import React from 'react';
import { Injector } from '@opensumi/common-di';
import * as Components from '@opensumi/ide-core-browser/lib/components';
import { IExtension } from '../../common';
import { AppConfig } from '@opensumi/ide-core-browser';
import { PortalRoot } from '../components/extension-portal-root';

export function createBrowserComponents(injector: Injector, extension: IExtension) {
  const appConfig: AppConfig = injector.get(AppConfig);

  if (!appConfig.useExperimentalShadowDom) {
    return Components;
  }

  return new Proxy(Components, {
    get(target, prop) {
      if (prop === 'Dialog' || prop === 'Overlay') {
        const OriginalComponent = Components[prop];

        return (props) => React.createElement(PortalRoot, { otherProps: props, extensionId: extension.id, original: OriginalComponent });
      }
      return target[prop];
    },
  });
}
