import cls from 'classnames';
import React, { ReactNode, useMemo } from 'react';

import { Injectable } from '@opensumi/di';
import { Icon } from '@opensumi/ide-components';
import { strings, transformLabelWithCodicon, useInjectable } from '@opensumi/ide-core-browser';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { IBrowserCtxMenu, IMenuRenderProps } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { BrowserCtxMenuService } from '@opensumi/ide-overlay/lib/browser/ctx-menu/ctx-menu.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import styles from '../style/design.module.less';

const MenuComponent = (props: { data: MenuNode } & IMenuRenderProps) => {
  const iconService = useInjectable<IconService>(IIconService);
  const { data, disabled, hasSubmenu } = props;

  const renderIcon = useMemo(() => {
    if (data.checked) {
      return <Icon icon='check' />;
    }

    if (data.icon) {
      return <Icon iconClass={data.icon} />;
    }

    return null;
  }, [data]);

  return (
    <div
      className={cls(
        styles.menuAction__sub_menu_action_container,
        {
          [styles.disabled]: disabled,
          [styles.checked]: data.checked,
        },
        data.className,
      )}
    >
      <div className={styles.icon}>{renderIcon}</div>
      <div className={styles.label}>
        {data.label
          ? transformLabelWithCodicon(
              strings.mnemonicButtonLabel(data.label, true),
              { margin: '0 3px' },
              iconService?.fromString.bind(iconService),
            )
          : ''}
      </div>
      <div className={styles.tip}>
        {data.keybinding ? <div className={styles.shortcut}>{data.keybinding}</div> : null}
        {hasSubmenu ? (
          <div className={styles.submenuIcon}>
            <Icon icon='right-arrow' />
          </div>
        ) : null}
        {!data.keybinding && !hasSubmenu && data.extraDesc && <div className={styles.extraDesc}>{data.extraDesc}</div>}
      </div>
    </div>
  );
};

@Injectable()
export class DesignBrowserCtxMenuService extends BrowserCtxMenuService implements IBrowserCtxMenu {
  renderSubMenuTitle(node: MenuNode, props: IMenuRenderProps): ReactNode | undefined | null {
    return <MenuComponent data={node} {...props} />;
  }

  renderMenuItem(node: MenuNode, props: IMenuRenderProps): ReactNode | undefined | null {
    return <MenuComponent data={node} {...props} />;
  }
}
