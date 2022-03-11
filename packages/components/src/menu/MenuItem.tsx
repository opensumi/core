import { Item } from 'rc-menu';
import React from 'react';

import MenuContext, { MenuContextProps } from './MenuContext';

import { ClickParam } from '.';

export interface MenuItemProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, 'title' | 'onClick' | 'onMouseEnter' | 'onMouseLeave'> {
  rootPrefixCls?: string;
  disabled?: boolean;
  level?: number;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (param: ClickParam) => void;
  onMouseEnter?: (e: { key: string; domEvent: React.MouseEvent<HTMLElement> }) => void;
  onMouseLeave?: (e: { key: string; domEvent: React.MouseEvent<HTMLElement> }) => void;
}

export default class MenuItem extends React.Component<MenuItemProps> {
  static isMenuItem = true;

  private menuItem: this;

  onKeyDown = (e: React.MouseEvent<HTMLElement>) => {
    this.menuItem.onKeyDown(e);
  };

  saveMenuItem = (menuItem: this) => {
    this.menuItem = menuItem;
  };

  renderItem = () => {
    const { title, ...rest } = this.props;

    return (
      <MenuContext.Consumer>
        {({ inlineCollapsed }: MenuContextProps) => {
          if (!inlineCollapsed) {
            return <Item {...rest} title={title} />;
          }
          return <Item {...rest} title={title} />;
        }}
      </MenuContext.Consumer>
    );
  };

  render() {
    return this.renderItem();
  }
}
