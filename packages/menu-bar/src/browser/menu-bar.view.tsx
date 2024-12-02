import cls from 'classnames';
import React from 'react';

import { ClickOutside } from '@opensumi/ide-components';
import { Dropdown } from '@opensumi/ide-components/lib/dropdown';
import { Deprecated } from '@opensumi/ide-components/lib/utils/deprecated';
import { ComponentRegistry, SlotRenderer, useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { InlineActionBar, MenuActionList } from '@opensumi/ide-core-browser/lib/components/actions';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { AbstractMenuService, IMenubarItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IIconService } from '@opensumi/ide-theme/lib/common/theme.service';

import styles from './menu-bar.module.less';
import { MenubarStore } from './menu-bar.store';

const MenubarItem = ({
  id,
  label,
  focusMode,
  afterMenubarClick,
  afterMenuClick,
}: IMenubarItem & {
  focusMode: boolean;
  afterMenuClick: () => void;
  afterMenubarClick: () => void;
}) => {
  const menubarStore = useInjectable<MenubarStore>(MenubarStore);
  const iconService = useInjectable<IIconService>(IIconService);
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
      overlay={<MenuActionList data={data} afterClick={handleMenuItemClick} iconService={iconService} />}
      trigger={focusMode ? ['click', 'hover'] : ['click']}
    >
      <div
        className={cls(styles.menubar, { [styles['menu-open']]: menuOpen })}
        onMouseOver={handleMouseOver}
        onClick={handleMenubarItemClick}
      >
        {label}
      </div>
    </Dropdown>
  );
};

// 点击一次后开启 focus mode, 此时 hover 也能出现子菜单
// outside click/contextmenu 之后解除 focus mode
// 点击 MenubarItem 也会解除 focus mode
// 点击 MenuItem 也会解除 focus mode
export const MenuBar = () => {
  const menubarStore = useInjectable<MenubarStore>(MenubarStore);
  const menubarItems = useAutorun(menubarStore.menubarItems);

  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);

  const [focusMode, setFocusMode] = React.useState(false);
  const relatedTarget = React.useRef<HTMLElement>();

  const handleMenubarFocusIn = React.useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!relatedTarget.current && e.relatedTarget) {
      relatedTarget.current = e.relatedTarget as HTMLElement;
    }
  }, []);

  const handleMenuItemClick = React.useCallback(() => {
    if (relatedTarget.current) {
      relatedTarget.current.focus();
      relatedTarget.current = undefined;
    }
    setFocusMode(false);
  }, [focusMode]);

  const handleMouseLeave = React.useCallback(() => {
    // 只有 focus 为 true 的时候, mouse leave 才会将其置为 false
    setFocusMode(false);
  }, [focusMode]);

  const LogoIcon = componentRegistry.getComponentRegistryInfo('@opensumi/ide-menu-bar-logo')?.views[0].component;

  return (
    <ClickOutside
      className={styles.menubars}
      style={{ height: layoutViewSize.menubarHeight }}
      mouseEvents={['click', 'contextmenu']}
      tabIndex={-1} // make focus event implement
      onFocus={handleMenubarFocusIn}
      onOutsideClick={handleMouseLeave}
    >
      {LogoIcon ? <LogoIcon /> : <div className={styles.logoIconEmpty}></div>}
      {menubarItems.map(({ id, label }) => (
        <MenubarItem
          key={id}
          id={id}
          label={label}
          focusMode={focusMode}
          afterMenuClick={handleMenuItemClick}
          afterMenubarClick={() => setFocusMode((r) => !r)}
        />
      ))}
    </ClickOutside>
  );
};

MenuBar.displayName = 'MenuBar';

type MenuBarMixToolbarActionProps = Pick<React.HTMLProps<HTMLElement>, 'className'>;

export const MenuBarMixToolbarAction: React.FC<MenuBarMixToolbarActionProps> = (props) => (
  <div className={cls(styles.menubarWrapper, props.className)}>
    <MenuBar />
    <SlotRenderer slot='action' flex={1} />
  </div>
);

MenuBarMixToolbarAction.displayName = 'MenuBarMixToolbarAction';

export const MenuBarActionWrapper = Deprecated(MenuBarMixToolbarAction, 'please use `MenuBarMixToolbarAction`');

/**
 * 可供集成方导入的组件
 * 后续如果有一些改动需要考虑是否有 breakchange
 */
export const IconMenuBar = () => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const menus = menuService.createMenu(MenuId.IconMenubarContext);

  return (
    <div className={styles.icon_menubar_container}>
      <InlineActionBar menus={menus} type='icon' className={styles.menubar_action} isFlattenMenu={true} />
    </div>
  );
};
