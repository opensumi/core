import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import * as clx from 'classnames';
import { ComponentContextProvider, IconContext } from '@ali/ide-components';
import { localize } from '@ali/ide-core-common';

import { IExtension, ExtensionService } from '../common';
import { IThemeService, getThemeTypeSelector, ThemeType } from '@ali/ide-theme';
import { useInjectable, DisposableCollection } from '@ali/ide-core-browser';
import './style.less';

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

function cloneNode(head) {
  return head.cloneNode(true);
}

/**
 * 由于经过 clone 以后，实际 Shadow DOM 中 head 与原始 proxiedHead 不是同一份引用
 * 插件中可能存在后置动态插入 style 的行为，此时只会获取到 proxiedHead
 * 所以这里观察原始 proxiedHead 的 DOM childList 变化
 * 当收到 mutations 时说明 head 标签被修改，将新插入的 style 节点 clone 一份到实际的 head 中
 * 删除节点同理
 */
function useMutationObserver(from: HTMLHeadElement, target: HTMLHeadElement) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        if (mutation.addedNodes.length > 0) {
          for (const addedNode of Array.from(mutation.addedNodes)) {
            target.appendChild(addedNode.cloneNode(true));
          }
        }
        if (mutation.removedNodes.length > 0) {
          for (const removedNode of Array.from(mutation.removedNodes)) {
            target.removeChild(removedNode);
          }
        }
      }
    }
  });
  observer.observe(from, {
    // 表示监听子元素列表变化
    childList: true,
    subtree: true,
  });
  return {
    dispose: () => {
      observer.disconnect();
    },
  };
}

const ShadowRoot = ({ id, extensionId, children, proxiedHead }: { id: string, extensionId: string, children: any, proxiedHead: HTMLHeadElement }) => {
  const shadowRootRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);
  const extensionService = useInjectable<ExtensionService>(ExtensionService);
  const themeService = useInjectable<IThemeService>(IThemeService);
  const [themeType, setThemeType] = useState<null | ThemeType>(null);

  useEffect(() => {
    const disposables = new DisposableCollection();
    if (shadowRootRef.current) {
      const shadowRootElement = shadowRootRef.current.attachShadow({ mode: 'open' });
      if (proxiedHead) {
        // 如果是一个插件注册了多个视图，节点需要被 clone 才能生效，否则第一个视图 appendChild 之后节点就没了
        const newNode = cloneNode(proxiedHead);
        disposables.push(useMutationObserver(proxiedHead, newNode));
        shadowRootElement.appendChild(newNode);
        const portalRoot = extensionService.getPortalShadowRoot(extensionId);
        if (portalRoot) {
          portalRoot.appendChild(proxiedHead);
        }
      }
      if (!shadowRoot) {
        setShadowRoot(shadowRootElement);
      }

      themeService.getCurrentTheme().then((res) => setThemeType(res.type));
      disposables.push(themeService.onThemeChange((e) => {
        if (e.type && e.type !== themeType) {
          setThemeType(e.type);
        }
      }));
      return disposables.dispose;
    }
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
    <ComponentContextProvider value={{ getIcon, localize }}>
      <ShadowRoot id={`${extension.id}-${id}`} extensionId={extension.id} proxiedHead={proxiedHead}><Component {...props} /></ShadowRoot>
    </ComponentContextProvider>
  );
}
