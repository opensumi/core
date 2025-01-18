import cls from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { ComponentContextProvider, IIconResourceOptions, IconContext } from '@opensumi/ide-components';
import {
  DisposableCollection,
  LabelService,
  TComponentCDNType,
  getCDNHref as getCDNHrefRaw,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { ExtensionBrowserStyleSheet, URI, localize } from '@opensumi/ide-core-common';
import {
  IIconService,
  IProductIconService,
  IThemeService,
  PRODUCT_ICON_STYLE_ID,
  ThemeType,
  getThemeTypeSelector,
} from '@opensumi/ide-theme';

import { IExtension } from '../common';
import { AbstractViewExtProcessService } from '../common/extension.service';

const pkgJson = require('../../package.json');

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

function cloneNode<T>(head): T {
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
            // TODO: 加入真正的 typing
            target.appendChild((addedNode as any).cloneNode(true));
          }
        }
        if (mutation.removedNodes.length > 0) {
          for (const removedNode of Array.from(mutation.removedNodes)) {
            if (target.contains(removedNode)) {
              target.removeChild(removedNode as any);
            }
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

const packageName = '@opensumi/ide-components';

function getCDNHref(filePath: string, version: string, cdnType: TComponentCDNType = 'alipay') {
  return getCDNHrefRaw(packageName, filePath, version, cdnType);
}

function getStyleSheet(href: string) {
  const link = document.createElement('link');
  link.setAttribute('href', href);
  link.setAttribute('rel', 'stylesheet');
  return link;
}

const ShadowRoot = ({
  id,
  extensionId,
  children,
  proxiedHead,
  cdnType,
  styleSheet,
}: {
  id: string;
  extensionId: string;
  children: any;
  proxiedHead: HTMLHeadElement;
  cdnType?: TComponentCDNType;
  styleSheet?: ExtensionBrowserStyleSheet;
}) => {
  const shadowRootRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);
  const viewExtensionService = useInjectable<AbstractViewExtProcessService>(AbstractViewExtProcessService);
  const themeService = useInjectable<IThemeService>(IThemeService);
  const iconService = useInjectable<IIconService>(IIconService);
  const productIconService = useInjectable<IProductIconService>(IProductIconService);
  const [themeType, setThemeType] = useState<null | ThemeType>(null);

  useEffect(() => {
    const disposables = new DisposableCollection();
    if (shadowRootRef.current) {
      const shadowRootElement = shadowRootRef.current.attachShadow({ mode: 'open' });
      if (proxiedHead) {
        if (styleSheet) {
          proxiedHead.appendChild(getStyleSheet(styleSheet.componentUri));
          proxiedHead.appendChild(getStyleSheet(styleSheet.iconfontUri));
        } else {
          proxiedHead.appendChild(getStyleSheet(getCDNHref('dist/index.css', pkgJson.version, cdnType)));
          proxiedHead.appendChild(
            getStyleSheet(getCDNHref('lib/icon/iconfont/iconfont.css', pkgJson.version, cdnType)),
          );
        }

        // 如果是一个插件注册了多个视图，节点需要被 clone 才能生效，否则第一个视图 appendChild 之后节点就没了
        const newHead = cloneNode<HTMLHeadElement>(proxiedHead);
        disposables.push(useMutationObserver(proxiedHead, newHead));
        // 注册 icon 相关的样式
        const iconStyle = document.createElement('style');
        iconStyle.id = 'icon-style';
        iconStyle.innerHTML = iconService.currentTheme?.styleSheetContent;
        newHead.appendChild(iconStyle);

        // 注册 producticon theme
        const productIconStyle = document.createElement('style');
        productIconStyle.id = PRODUCT_ICON_STYLE_ID;
        productIconStyle.innerHTML = productIconService.currentTheme?.styleSheetContent || '';
        newHead.appendChild(productIconStyle);

        disposables.pushAll([
          iconService.onThemeChange((e) => {
            iconStyle.innerHTML = e.styleSheetContent;
          }),
        ]);
        shadowRootElement.appendChild(newHead);
        const portalRoot = viewExtensionService.getPortalShadowRoot(extensionId);
        if (portalRoot) {
          portalRoot.appendChild(proxiedHead);
        }
      }
      if (!shadowRoot) {
        setShadowRoot(shadowRootElement);
      }

      themeService.getCurrentTheme().then((res) => setThemeType(res.type));
      disposables.push(
        themeService.onThemeChange((e) => {
          if (e.type && e.type !== themeType) {
            setThemeType(e.type);
          }
        }),
      );
      return disposables.dispose.bind(disposables);
    }
  }, []);

  return (
    <div id={id} style={{ width: '100%', height: '100%' }} ref={shadowRootRef}>
      {shadowRoot && (
        <ShadowContent root={shadowRoot}>
          <div
            className={cls(getThemeTypeSelector(themeType!), 'shadow-context-wrapper', 'show-file-icons')}
            style={{ width: '100%', height: '100%' }}
          >
            {children}
          </div>
        </ShadowContent>
      )}
    </div>
  );
};

export function getShadowRoot(
  panel,
  extension: IExtension,
  props,
  id,
  proxiedHead,
  type?: TComponentCDNType,
  extensionBrowserStyleSheet?: ExtensionBrowserStyleSheet,
) {
  const Component = panel;
  const { getIcon } = React.useContext(IconContext);
  const labelService = useInjectable<LabelService>(LabelService);
  const getResourceIcon = useCallback(
    (uri: string, options: IIconResourceOptions) => labelService.getIcon(URI.parse(uri), options),
    [],
  );

  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <ShadowRoot
        id={`${extension.id}-${id}`}
        extensionId={extension.id}
        proxiedHead={proxiedHead}
        cdnType={type}
        styleSheet={extensionBrowserStyleSheet}
      >
        <Component {...props} />
      </ShadowRoot>
    </ComponentContextProvider>
  );
}
