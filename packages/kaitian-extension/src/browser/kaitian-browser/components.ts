import * as React from 'react';
import { Injector } from '@ali/common-di';
import * as Components from '@ali/ide-core-browser/lib/components';
import { ExtensionService, IExtension } from '../../common';
import { AppConfig } from '@ali/ide-core-browser';

export function createBrowserComponents(injector: Injector, extension: IExtension) {
  const appConfig: AppConfig = injector.get(AppConfig);

  if (!appConfig.useExperimentalShadowDom) {
    return Components;
  }

  const extensionService: ExtensionService = injector.get(ExtensionService);
  return  new Proxy(Components, {
    get(target, prop) {
      if (prop === 'Dialog' || prop === 'Overlay') {
        const OriginalComponent = Components[prop];
        const proxiedComponent = (props) => React.createElement(OriginalComponent, { ...props, getContainer: () => {
          const portalRoot = extensionService.getPortalShadowRoot(extension.id);
          return portalRoot;
        } });
        return proxiedComponent;
      }
      return target[prop];
    },
  });
}
