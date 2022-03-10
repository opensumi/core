import classNames from 'classnames';
import RcMenu, { Divider, ItemGroup } from 'rc-menu';
import React from 'react';
import { polyfill } from 'react-lifecycles-compat';

import collapseMotion from '../utils/motion';
import raf from '../utils/raf';
import { warning } from '../utils/warning';

import MenuContext from './MenuContext';
import Item from './MenuItem';
import SubMenu from './SubMenu';
import './style.less';

export interface SelectParam {
  key: string;
  keyPath: Array<string>;
  item: any;
  domEvent: Event;
  selectedKeys: Array<string>;
}

export interface ClickParam {
  key: string;
  keyPath: Array<string>;
  item: any;
  domEvent: Event;
}

export type MenuMode = 'vertical' | 'vertical-left' | 'vertical-right' | 'horizontal' | 'inline';

export interface MenuProps {
  id?: string;
  mode?: MenuMode;
  selectable?: boolean;
  selectedKeys?: Array<string>;
  defaultSelectedKeys?: Array<string>;
  openKeys?: Array<string>;
  defaultOpenKeys?: Array<string>;
  onOpenChange?: (openKeys: string[]) => void;
  onSelect?: (param: SelectParam) => void;
  onDeselect?: (param: SelectParam) => void;
  onClick?: (param: ClickParam) => void;
  style?: React.CSSProperties;
  openAnimation?: string;
  openTransitionName?: string;
  motion?: object;
  className?: string;
  prefixCls?: string;
  multiple?: boolean;
  inlineIndent?: number;
  inlineCollapsed?: boolean;
  subMenuCloseDelay?: number;
  subMenuOpenDelay?: number;
  focusable?: boolean;
  onMouseEnter?: (e: MouseEvent) => void;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  overflowedIndicator?: React.ReactNode;
  forceSubMenuRender?: boolean;
}

type InternalMenuProps = MenuProps;

export interface MenuState {
  openKeys: string[];

  // This may be not best way since origin code use `this.switchingModeFromInline` to handle collapse management.
  // But for current test, seems it's OK just use state.
  switchingModeFromInline: boolean;
  inlineOpenKeys: string[];
  prevProps: InternalMenuProps;
}

class InternalMenu extends React.Component<InternalMenuProps, MenuState> {
  static defaultProps: Partial<MenuProps> = {
    className: '',
    focusable: false,
  };

  static getDerivedStateFromProps(nextProps: InternalMenuProps, prevState: MenuState) {
    const { prevProps } = prevState;
    const newState: Partial<MenuState> = {
      prevProps: nextProps,
    };
    if (prevProps.mode === 'inline' && nextProps.mode !== 'inline') {
      newState.switchingModeFromInline = true;
    }

    if ('openKeys' in nextProps) {
      newState.openKeys = nextProps.openKeys;
    } else {
      // [Legacy] Old code will return after `openKeys` changed.
      // Not sure the reason, we should keep this logic still.
      if (nextProps.inlineCollapsed && !prevProps.inlineCollapsed) {
        newState.switchingModeFromInline = true;
        newState.inlineOpenKeys = prevState.openKeys;
        newState.openKeys = [];
      }

      if (!nextProps.inlineCollapsed && prevProps.inlineCollapsed) {
        newState.openKeys = prevState.inlineOpenKeys;
        newState.inlineOpenKeys = [];
      }
    }

    return newState;
  }

  private mountRafId: number;

  constructor(props: InternalMenuProps) {
    super(props);

    warning(
      !('onOpen' in props || 'onClose' in props),
      '[Menu] `onOpen` and `onClose` are removed, please use `onOpenChange` instead, ' +
        'see: https://u.ant.design/menu-on-open-change.',
    );

    warning(
      !('inlineCollapsed' in props && props.mode !== 'inline'),
      '[Menu] `inlineCollapsed` should only be used when `mode` is inline.',
    );

    let openKeys;
    if ('openKeys' in props) {
      openKeys = props.openKeys;
    } else if ('defaultOpenKeys' in props) {
      openKeys = props.defaultOpenKeys;
    }

    this.state = {
      openKeys: openKeys || [],
      switchingModeFromInline: false,
      inlineOpenKeys: [],
      prevProps: props,
    };
  }

  componentWillUnmount() {
    raf.cancel(this.mountRafId);
  }

  setOpenKeys(openKeys: string[]) {
    if (!('openKeys' in this.props)) {
      this.setState({ openKeys });
    }
  }

  getRealMenuMode() {
    const inlineCollapsed = this.getInlineCollapsed();
    if (this.state.switchingModeFromInline && inlineCollapsed) {
      return 'inline';
    }
    const { mode } = this.props;
    return inlineCollapsed ? 'vertical' : mode;
  }

  getInlineCollapsed() {
    const { inlineCollapsed } = this.props;
    return inlineCollapsed;
  }

  getOpenMotionProps(menuMode: MenuMode): { openTransitionName?: any; openAnimation?: any; motion?: object } {
    const { openTransitionName, openAnimation, motion } = this.props;

    // Provides by user
    if (motion) {
      return { motion };
    }

    if (openAnimation) {
      warning(
        typeof openAnimation === 'string',
        '[Menu] `openAnimation` do not support object. Please use `motion` instead.',
      );
      return { openAnimation };
    }

    if (openTransitionName) {
      return { openTransitionName };
    }

    // Default logic
    if (menuMode === 'horizontal') {
      return { motion: { motionName: 'slide-up' } };
    }

    if (menuMode === 'inline') {
      return { motion: collapseMotion };
    }

    // When mode switch from inline
    // submenu should hide without animation
    return {
      motion: {
        motionName: this.state.switchingModeFromInline ? '' : 'zoom-big',
      },
    };
  }

  // Restore vertical mode when menu is collapsed responsively when mounted
  // https://github.com/ant-design/ant-design/issues/13104
  // not a perfect solution, looking a new way to avoid setting switchingModeFromInline in this situation
  handleMouseEnter = (e: MouseEvent) => {
    this.restoreModeVerticalFromInline();
    const { onMouseEnter } = this.props;
    if (onMouseEnter) {
      onMouseEnter(e);
    }
  };

  handleTransitionEnd = (e: TransitionEvent) => {
    // when inlineCollapsed menu width animation finished
    // https://github.com/ant-design/ant-design/issues/12864
    const widthCollapsed = e.propertyName === 'width' && e.target === e.currentTarget;

    // Fix SVGElement e.target.className.indexOf is not a function
    // https://github.com/ant-design/ant-design/issues/15699
    const { className } = e.target as HTMLElement | SVGElement;
    // SVGAnimatedString.animVal should be identical to SVGAnimatedString.baseVal, unless during an animation.
    const classNameValue =
      Object.prototype.toString.call(className) === '[object SVGAnimatedString]' ? className.animVal : className;

    // Fix for <Menu style={{ width: '100%' }} />, the width transition won't trigger when menu is collapsed
    // https://github.com/ant-design/ant-design-pro/issues/2783
    const iconScaled = e.propertyName === 'font-size' && classNameValue.indexOf('anticon') >= 0;
    if (widthCollapsed || iconScaled) {
      this.restoreModeVerticalFromInline();
    }
  };

  handleClick = (e: ClickParam) => {
    this.handleOpenChange([]);

    const { onClick } = this.props;
    if (onClick) {
      onClick(e);
    }
  };

  handleOpenChange = (openKeys: string[]) => {
    this.setOpenKeys(openKeys);

    const { onOpenChange } = this.props;
    if (onOpenChange) {
      onOpenChange(openKeys);
    }
  };

  restoreModeVerticalFromInline() {
    const { switchingModeFromInline } = this.state;
    if (switchingModeFromInline) {
      this.setState({
        switchingModeFromInline: false,
      });
    }
  }

  renderMenu = () => {
    const { prefixCls: customizePrefixCls, className } = this.props;
    const menuMode = this.getRealMenuMode();
    const menuOpenMotion = this.getOpenMotionProps(menuMode!);

    const prefixCls = customizePrefixCls || 'kt-inner-menu';
    const menuClassName = classNames(className, {
      [`${prefixCls}-inline-collapsed`]: this.getInlineCollapsed(),
    });

    const menuProps: MenuProps = {
      openKeys: this.state.openKeys,
      onOpenChange: this.handleOpenChange,
      className: menuClassName,
      mode: menuMode,

      // Motion
      ...menuOpenMotion,
    };

    if (menuMode !== 'inline') {
      // closing vertical popup submenu after click it
      menuProps.onClick = this.handleClick;
    }

    const hideMenu = this.getInlineCollapsed();
    if (hideMenu) {
      menuProps.openKeys = [];
    }

    return (
      <RcMenu
        {...this.props}
        {...menuProps}
        prefixCls={prefixCls}
        // @ts-ignore
        onTransitionEnd={this.handleTransitionEnd}
        onMouseEnter={this.handleMouseEnter}
      />
    );
  };

  render() {
    return (
      <MenuContext.Provider
        value={{
          inlineCollapsed: this.getInlineCollapsed() || false,
        }}
      >
        {this.renderMenu()}
      </MenuContext.Provider>
    );
  }
}

polyfill(InternalMenu);

// We should keep this as ref-able
export class Menu extends React.Component<MenuProps, {}> {
  static Divider = Divider;

  static Item = Item;

  static SubMenu = SubMenu;

  static ItemGroup = ItemGroup;

  render() {
    return <InternalMenu {...this.props} />;
  }
}
