import clsx from 'classnames';
import React, { ReactNode, useMemo } from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { Icon } from '@opensumi/ide-components';
import { strings, transformLabelWithCodicon, useInjectable } from '@opensumi/ide-core-browser';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { IMenuRenderProps } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { BrowserCtxMenuService } from '@opensumi/ide-overlay/lib/browser/ctx-menu/ctx-menu.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import * as styles from './override.module.less';

const MenuComponent = (props: { node: MenuNode } & IMenuRenderProps) => {
  const iconService = useInjectable<IconService>(IIconService);
  const { node, disabled, hasSubmenu } = props;

  const renderIcon = useMemo(() => {
    if (node.checked) {
      return <Icon icon='check' />;
    }

    if (node.icon) {
      return <Icon iconClass={node.icon} />;
    }

    return null;
  }, [node]);

  return (
    <div
      className={clsx(styles.ai_sub_menu_action_container, {
        [styles.disabled]: disabled,
        [styles.checked]: node.checked,
      })}
    >
      <div className={styles.icon}>{renderIcon}</div>
      <div className={styles.label}>
        {node.label
          ? transformLabelWithCodicon(
              strings.mnemonicButtonLabel(node.label, true),
              { margin: '0 3px' },
              iconService?.fromString.bind(iconService),
            )
          : ''}
      </div>
      <div className={styles.tip}>
        {node.keybinding ? <div className={styles.shortcut}>{node.keybinding}</div> : null}
        {hasSubmenu ? (
          <div className={styles.submenuIcon}>
            <Icon icon='caret-right' />
          </div>
        ) : null}
        {!node.keybinding && !hasSubmenu && node.extraDesc && <div className={styles.extraDesc}>{node.extraDesc}</div>}
      </div>
    </div>
  );
};

@Injectable()
export class AiBrowserCtxMenuService extends BrowserCtxMenuService {
  renderSubMenuTitle(node: MenuNode, props: IMenuRenderProps): ReactNode | undefined | null {
    return <MenuComponent node={node} {...props} />;
  }

  renderMenuItem(node: MenuNode, props: IMenuRenderProps): ReactNode | undefined | null {
    return <MenuComponent node={node} {...props} />;
  }
}
