import * as React from 'react';
import { Dropdown, Menu } from 'antd';

import { ClickParam } from 'antd/lib/menu';
import 'antd/lib/menu/style/index.less';
import 'antd/lib/dropdown/style/index.less';

import { MenuNode } from '../../menu/next/base';
import { SeparatorMenuItemNode } from '../../menu/next/menu-service';
import Icon from '../icon';

import * as styles from './styles.module.less';

const MenuAction: React.FC<{
  data: MenuNode;
}> = ({ data }) => {
  return (
    <>
      <div className={styles.icon}>
        { data.icon && <Icon iconClass={data.icon} /> }
      </div>
      {data.label}
      <div className={styles.shortcut}>{data.shortcut}</div>
      <div className={styles.submenuIcon}>
        {/* need a arrow right here */}
      </div>
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
      selectedKeys={[]}
      onClick={handleClick}>
      {
        data.map((menuNode, index) => {
          if (menuNode.id === SeparatorMenuItemNode.ID) {
            return <Menu.Divider key={`divider-${index}`} />;
          }
          return (
            <Menu.Item key={menuNode.id}>
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
}> = ({ data, context }) => {
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
  return (
    <div>
      {
        primary.map((item) => <IconAction key={item.id} data={item} context={context} />)
      }
      {
        secondary.length > 0
          ? <Dropdown overlay={<MenuActionList data={secondary} />}>
            <i className='fa fa-ellipsis-h' />
          </Dropdown>
          : null
      }
    </div>
  );
};
