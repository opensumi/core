import clx from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { ClickOutside } from '@opensumi/ide-components';
import { Dropdown } from '@opensumi/ide-components/lib/dropdown';
import { Deprecated } from '@opensumi/ide-components/lib/utils/deprecated';
import { useInjectable, SlotRenderer, ComponentRegistry } from '@opensumi/ide-core-browser';
import { MenuActionList } from '@opensumi/ide-core-browser/lib/components/actions';
import { IMenubarItem } from '@opensumi/ide-core-browser/lib/menu/next';

import styles from './menu-bar.module.less';
import { MenubarStore } from './menu-bar.store';

const MenubarItem = observer<
  IMenubarItem & {
    focusMode: boolean;
    afterMenuClick: () => void;
    afterMenubarClick: () => void;
  }
>(({ id, label, focusMode, afterMenubarClick, afterMenuClick }) => {
  const menubarStore = useInjectable<MenubarStore>(MenubarStore);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);

  const handleMenubarItemClick = React.useCallback(() => {
    menubarStore.handleMenubarClick(id);
    if (focusMode) {
      setMenuOpen(true);
    } else {
      setMenuOpen((r) => !r);
    }
    afterMenubarClick();
  }, [id]);

  const handleMenuItemClick = () => {
    setMenuOpen(false);
    afterMenuClick();
  };

  const handleMouseOver = React.useCallback(() => {
    // 只有 focus mode 下才会 hover 时重新生成数据
    if (focusMode) {
      menubarStore.handleMenubarClick(id);
    }
  }, [id, focusMode]);

  const triggerMenuVisibleChange = (visible: boolean) => {
    setMenuOpen(visible);
  };

  const data = menubarStore.menuItems.get(id) || [];

  return (
    <Dropdown
      className={'kt-menu'}
      transitionName=''
      align={{
        offset: [0, 0],
      }}
      visible={menuOpen}
      onVisibleChange={triggerMenuVisibleChange}
      overlay={<MenuActionList data={data} afterClick={handleMenuItemClick} />}
      trigger={focusMode ? ['click', 'hover'] : ['click']}
    >
      <div
        className={clx(styles.menubar, { [styles['menu-open']]: menuOpen })}
        onMouseOver={handleMouseOver}
        onClick={handleMenubarItemClick}
      >
        {label}
      </div>
    </Dropdown>
  );
});

// 点击一次后开启 focus mode, 此时 hover 也能出现子菜单
// outside click/contextmenu 之后解除 focus mode
// 点击 MenubarItem 也会解除 focus mode
// 点击 MenuItem 也会解除 focus mode
export const MenuBar = observer(() => {
  const menubarStore = useInjectable<MenubarStore>(MenubarStore);
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);
  const [focusMode, setFocusMode] = React.useState(false);

  const handleMouseLeave = React.useCallback(() => {
    // 只有 focus 为 true 的时候, mouse leave 才会将其置为 false
    setFocusMode(false);
  }, [focusMode]);

  const LogoIcon = componentRegistry.getComponentRegistryInfo('@opensumi/ide-menu-bar-logo')?.views[0].component;

  return (
    <ClickOutside className={styles.menubars} mouseEvents={['click', 'contextmenu']} onOutsideClick={handleMouseLeave}>
      {LogoIcon ? <LogoIcon /> : <div className={styles.logoIconEmpty}></div>}
      {menubarStore.menubarItems.map(({ id, label }) => (
        <MenubarItem
          key={id}
          id={id}
          label={label}
          focusMode={focusMode}
          afterMenuClick={() => setFocusMode(false)}
          afterMenubarClick={() => setFocusMode((r) => !r)}
        />
      ))}
    </ClickOutside>
  );
});

MenuBar.displayName = 'MenuBar';

type MenuBarMixToolbarActionProps = Pick<React.HTMLProps<HTMLElement>, 'className'>;

export const MenuBarMixToolbarAction: React.FC<MenuBarMixToolbarActionProps> = (props) => (
  <div className={clx(styles.menubarWrapper, props.className)}>
    <MenuBar />
    <SlotRenderer slot='action' flex={1} overflow={'initial'} />
  </div>
);

MenuBarMixToolbarAction.displayName = 'MenuBarMixToolbarAction';

export const MenuBarActionWrapper = Deprecated(MenuBarMixToolbarAction, 'please use `MenuBarMixToolbarAction`');
