import * as React from 'react';
import { mnemonicButtonLabel } from '@ali/ide-core-common/lib/utils/strings';

import Menu, { ClickParam } from 'antd/lib/menu';
import 'antd/lib/menu/style/index.less';

import { MenuNode, ICtxMenuRenderer, SeparatorMenuItemNode, IMenu, MenuSeparator } from '../../menu/next';
import Icon from '../icon';
import { getIcon } from '../../icon';
import { useInjectable } from '../../react-hooks';
import { useMenus } from '../../utils';

import * as styles from './styles.module.less';

const MenuAction: React.FC<{
  data: MenuNode;
}> = ({ data }) => {
  // 这里遵循 native menu 的原则，保留一个 icon 位置
  return (
    <>
      <div className={styles.icon}>
        {
          data.checked
           ? <Icon icon='check' />
           : null
        }
      </div>
      <div className={styles.label}>
        {data.label ? mnemonicButtonLabel(data.label, true) : ''}
      </div>
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
  context?: any[];
}> = ({ data = [], context = [], onClick }) => {
  if (!data.length) {
    return null;
  }

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
  context?: any[];
} & React.HTMLAttributes<HTMLDivElement>> = ({ data, context = [], ...restProps }) => {
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
const TitleActionList: React.FC<{
  nav: MenuNode[];
  more?: MenuNode[];
  context?: any[];
}> = ({ nav: primary = [], more: secondary = [], context = [] }) => {
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

type TupleContext<T, U, K, M> = (
  M extends undefined
  ? K extends undefined
    ? U extends undefined
      ? T extends undefined
        ? undefined
        : [T]
      : [T, U]
    : [T, U, K]
  : [T, U, K, M]
);

export function InlineActionBar<T = undefined, U = undefined, K = undefined, M = undefined>(props: {
  context?: TupleContext<T, U, K, M>;
  menus: IMenu;
  seperator?: MenuSeparator;
}): React.ReactElement<{
  context?: TupleContext<T, U, K, M>;
  menus: IMenu;
  seperator?: MenuSeparator;
}> {
  const { menus, context, seperator } = props;
  // todo: 从一致性考虑是否这里不用 context 的命名
  const [navMenu, moreMenu] = useMenus(menus, seperator, context);

  // inline 菜单不取第二组，对应内容由关联 context menu 去渲染
  return (
    <TitleActionList
      nav={navMenu}
      more={seperator === 'inline' ? [] : moreMenu} />
  );
}
