import * as React from 'react';
import { Injector } from '@ali/common-di';
import * as Components from '@ali/ide-core-browser/lib/components';
import { ExtensionService, IExtension } from '../../common';

export function createBrowserComponents(injector: Injector, useProxy: boolean, extension: IExtension) {
  if (!useProxy) {
    return Components;
  }
  const extensionService: ExtensionService = injector.get(ExtensionService);
  return  new Proxy(Components, {
    get(target, prop) {
      if (prop === 'Dialog' || prop === 'Overlay') {
        const portalRoot = extensionService.getPortalShadowRoot(extension.id);
        const OriginalComponent = Components[prop];
        const proxiedComponent = (props) => React.createElement(OriginalComponent, { ...props, getContainer: () => {
          return portalRoot;
        } });
        return proxiedComponent;
      }
      return target[prop];
    },
  });
}
