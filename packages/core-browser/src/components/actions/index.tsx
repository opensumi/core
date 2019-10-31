import * as React from 'react';
import { Menu } from 'antd';
import { mnemonicButtonLabel } from '@ali/ide-core-common/lib/utils/strings';

import { ClickParam } from 'antd/lib/menu';
import 'antd/lib/menu/style/index.less';
import 'antd/lib/dropdown/style/index.less';

import { MenuNode, ICtxMenuRenderer, SeparatorMenuItemNode } from '../../menu/next';
import Icon from '../icon';
import { getIcon } from '../../icon';
import { useInjectable } from '../../react-hooks';

import * as styles from './styles.module.less';

const MenuAction: React.FC<{
  data: MenuNode;
}> = ({ data }) => {
  return (
    <>
      <div className={styles.icon}>
        { data.icon && <Icon iconClass={data.icon} /> }
      </div>
      <div className={styles.label}>{mnemonicButtonLabel(data.label)}</div>
      {
        data.keybinding
          ? <div className={styles.shortcut}>{data.keybinding}</div>
          : null
      }
      {/* <div className={styles.submenuIcon}>
        <Icon iconClass={getIcon('right')} />
      </div> */}
    </>
  );
};

/**
 * 用于 context menu
 */
export const MenuActionList: React.FC<{
  data: MenuNode[];
  onClick?: (item: MenuNode) => void;
  context?: any;
}> = ({ data = [], context, onClick }) => {
  const handleClick = React.useCallback(({ key }: ClickParam) => {
    // do nothing when click separator node
    if (key === SeparatorMenuItemNode.ID) {
      return;
    }

    const menuItem = data.find((n) => n.id === key);
    if (menuItem && menuItem.execute) {
      menuItem.execute(context);
      if (typeof onClick === 'function') {
        onClick(menuItem);
      }
    }
  }, [ data, context ]);

  return (
    <Menu
      mode='inline'
      selectable={false}
      onClick={handleClick}>
      {
        data.map((menuNode, index) => {
          if (menuNode.id === SeparatorMenuItemNode.ID) {
            return <Menu.Divider key={`divider-${index}`} />;
          }
          return (
            <Menu.Item key={menuNode.id} disabled={menuNode.disabled}>
              <MenuAction key={menuNode.id} data={menuNode} />
            </Menu.Item>
          );
        })
      }
    </Menu>
  );
};

const IconAction: React.FC<{
  data: MenuNode;
  context?: any;
} & React.HTMLAttributes<HTMLDivElement>> = ({ data, context, ...restProps }) => {
  const handleClick = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof data.execute === 'function') {
      data.execute(context);
    }
  }, [ data, context ]);

  return (
    <Icon
      title={data.label}
      iconClass={data.icon}
      onClick={handleClick}
      {...restProps}
    />
  );
};

/**
 * 用于 scm/title or view/title or inline actions
 */
export const TitleActionList: React.FC<{
  nav: MenuNode[];
  more?: MenuNode[];
  context?: any;
}> = ({ nav: primary = [], more: secondary = [], context }) => {
  const ctxMenuRenderer = useInjectable(ICtxMenuRenderer);

  const handleShowMore = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (secondary) {
      ctxMenuRenderer.show({
        anchor: { x: e.clientX, y: e.clientY },
        // 合并结果
        menuNodes: secondary,
        context,
      });
    }
  }, [ secondary, context ]);

  return (
    <div className={styles.titleActions}>
      {
        primary.map((item) => (
          <IconAction
            className={styles.iconAction}
            key={item.id}
            data={item}
            context={context} />
        ))
      }
      {
        secondary.length > 0
          ? <span
            className={`${styles.iconAction} ${getIcon('ellipsis')} icon-ellipsis`}
            onClick={handleShowMore} />
          : null
      }
      {/* {
        secondary.length > 0
          ? <Dropdown
            transitionName=''
            trigger={['click']}
            overlay={<MenuActionList data={secondary} context={context} />}>
            <span className={`${styles.iconAction} ${getIcon('ellipsis')} icon-ellipsis`} />
          </Dropdown>
          : null
      } */}
    </div>
  );
};
