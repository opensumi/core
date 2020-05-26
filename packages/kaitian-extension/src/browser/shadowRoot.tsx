import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import * as clx from 'classnames';
import { IconContextProvider, IconContext } from '@ali/ide-components';

import { IExtension, ExtensionService } from '../common';
import { useInjectable } from '@ali/ide-core-browser';
import { IThemeService, getThemeTypeSelector, ThemeType } from '@ali/ide-theme';
import './style.less';

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

function cloneNode(head) {
  return head.cloneNode(true);
}

const ShadowRoot = ({ id, extensionId, children, proxiedHead }: { id: string, extensionId: string, children: any, proxiedHead: HTMLHeadElement }) => {
  const shadowRootRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);
  const extensionService = useInjectable<ExtensionService>(ExtensionService);
  const themeService = useInjectable<IThemeService>(IThemeService);
  const [themeType, setThemeType] = useState<null | ThemeType>(null);

  useEffect(() => {
    if (shadowRootRef.current) {
      const shadowRootElement = shadowRootRef.current.attachShadow({ mode: 'open' });
      if (proxiedHead) {
        // 如果是一个插件注册了多个视图，节点需要被 clone 才能生效，否则第一个视图 appendChild 之后节点就没了
        shadowRootElement.appendChild(cloneNode(proxiedHead));
        const portalRoot = extensionService.getPortalShadowRoot(extensionId);
        if (portalRoot) {
          portalRoot.appendChild(proxiedHead);
        }
      }
      if (!shadowRoot) {
        setShadowRoot(shadowRootElement);
      }
    }

    themeService.getCurrentTheme()
      .then((res) => {
        setThemeType(res.type);
      });
    const disposable = themeService.onThemeChange((e) => {
      if (e.type && e.type !== themeType) {
        setThemeType(e.type);
      }
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  return (
    <div id={id} className={clx('shadow-root-host')} ref={shadowRootRef}>
      {shadowRoot && <ShadowContent root={shadowRoot}>
        <div className={clx(getThemeTypeSelector(themeType!), 'shadow-context-wrapper')} style={{ width: '100%', height: '100%' }}>{children}</div>
      </ShadowContent>}
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
