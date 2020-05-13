import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect, useRef } from 'react';
import { IconContextProvider, IconContext } from '@ali/ide-components';

import { IExtension, ExtensionService } from '../common';
import { useInjectable } from '@ali/ide-core-browser';

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

function cloneNode(head) {
  return head.cloneNode(true);
}

const ShadowRoot = ({ id, extensionId, children, proxiedHead }: { id: string, extensionId: string, children: any, proxiedHead: HTMLHeadElement }) => {
  const shadowRootRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);
  const extensionService = useInjectable<ExtensionService>(ExtensionService);

  useEffect(() => {
    if (shadowRootRef.current) {
      const shadowRootElement = shadowRootRef.current.attachShadow({ mode: 'open' });
      if (proxiedHead) {
        // 如果是一个插件注册了多个视图，节点需要被 clone 才能生效，否则第一个视图 appendChild 之后节点就没了
        shadowRootElement.appendChild(cloneNode(proxiedHead));
      }
      const shadowBody = extensionService.getShadowRootBody(extensionId);
      shadowBody.style.height = '0%';
      shadowRootElement.appendChild(shadowBody);
      extensionService.registerShadowRootBody(extensionId, shadowBody);
      if (!shadowRoot) {
        setShadowRoot(shadowRootElement);
      }
    }
  }, []);

  return (
    <div id={id} style={{ width: '100%', height: '100%' }} ref={shadowRootRef}>
      {shadowRoot && <ShadowContent root={shadowRoot}>{children}</ShadowContent>}
    </div>
  );
};

export function getShadowRoot(panel, extension: IExtension, props, id, proxiedHead) {
  const Component = panel;
  const { getIcon } = React.useContext(IconContext);
  return (
    <IconContextProvider value={{ getIcon }}>
      <ShadowRoot id={`${extension.id}-${id}`} extensionId={extension.id} proxiedHead={proxiedHead}><Component {...props} /></ShadowRoot>
    </IconContextProvider>
  );
}
