import * as React from 'react';
import { localize, useMenus } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { Button, Icon } from '@ali/ide-core-browser/lib/components';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import * as clx from 'classnames';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { generateCtxMenu, ICtxMenuRenderer, IMenu } from '@ali/ide-core-browser/lib/menu/next';

import { RawExtension, IExtensionManagerService } from '../../../common';
import * as commonStyles from '../../extension-manager.common.module.less';
import * as styles from './index.module.less';

interface RawExtensionProps extends React.HTMLAttributes<HTMLDivElement> {
  extension: RawExtension;
  select: (extension: RawExtension, isDouble: boolean) => void;
  install: (extension: RawExtension) => Promise<void>;
  // 是否显示已安装文案
  showInstalled?: boolean;
}

export const RawExtensionView: React.FC<RawExtensionProps> = observer(({
   extension, select, install, className, showInstalled,
  }) => {
  const [installing, setInstalling] = React.useState(false);
  const timmer = React.useRef<any>();
  const clickCount = React.useRef(0);

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);

  async function handleInstall(e) {
    e.stopPropagation();
    setInstalling(true);
    await install(extension);
    setInstalling(false);
  }

  function handleClick(e) {
    clickCount.current++;
    clearTimeout(timmer.current);
    timmer.current = setTimeout(() => {
      if (clickCount.current === 1) {
        select(extension, false);
      } else if (clickCount.current === 2) {
        select(extension, true);
      }
      clickCount.current = 0;
    }, 200);
  }

  const handleCtxMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    // 只有已安装才有右键菜单
    if (!extension.installed) {
      return;
    }

    const result = generateCtxMenu({ menus: extensionManagerService.contextMenu });

    ctxMenuRenderer.show({
      anchor: { x: e.clientX, y: e.clientY },
      menuNodes: result[1],
      context: ['hello world'],
    });
  }, []);

  return (
    <div className={className} onContextMenu={handleCtxMenu}>
      <div onClick={handleClick} className={styles.wrap}>
        <div>
          <img className={styles.icon} src={extension.icon}></img>
        </div>
        <div className={styles.info_wrap}>
          <div className={styles.info_header}>
            <div className={styles.name_wrapper}>
              <div className={styles.name}>{extension.displayName}</div>
              {extension.isBuiltin ? (<span className={commonStyles.tag}>{localize('marketplace.extension.builtin')}</span>) : null}
            </div>
            {!extension.installed && <Button loading={installing} onClick={handleInstall} ghost={true} style={{flexShrink: 0}}>{localize('marketplace.extension.install')}</Button>}
            {extension.installed && showInstalled ? (<span style={{flexShrink: 0}}>{localize('marketplace.extension.installed')}</span>) : null}
          </div>
          <div className={styles.extension_props}>
            {extension.downloadCount ? (<span><i className={clx(commonStyles.icon, getIcon('download'))}></i>{extension.downloadCount}</span>) : null}
            <span>V{extension.version}</span>
            <span>{extension.publisher}</span>
          </div>
          <div className={styles.description}>{extension.description}</div>
          {
            extension.installed && (
              <InlineActionBar
                menus={extensionManagerService.contextMenu}
                context={['hello world']} />
            )
          }
        </div>
      </div>
    </div>
  );
});
