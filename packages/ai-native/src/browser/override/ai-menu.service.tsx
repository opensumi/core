import clsx from 'classnames';
import React, { ReactNode } from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { Icon } from '@opensumi/ide-components';
import { strings, transformLabelWithCodicon, useInjectable } from '@opensumi/ide-core-browser';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { BrowserCtxMenuService } from '@opensumi/ide-overlay/lib/browser/ctx-menu/ctx-menu.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import * as styles from './override.module.less';

const SubMenuComponent = (props: { node: MenuNode }) => {
  const iconService = useInjectable<IconService>(IIconService);
  const { node } = props;

  return (
    <div className={styles.ai_sub_menu_action_container}>
      <div className={styles.icon}>{node.icon ? <Icon iconClass={node.icon} /> : null}</div>
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
        <div className={styles.submenuIcon}>
          <Icon icon='caret-right' />
        </div>
        <div className={styles.extraDesc}>{node.extraDesc}</div>
      </div>
    </div>
  );
};

@Injectable()
export class AiBrowserCtxMenuService extends BrowserCtxMenuService {
  override renderSubMenuTitle(node: MenuNode): ReactNode | undefined | null {
    return <SubMenuComponent node={node} />;
  }
}
