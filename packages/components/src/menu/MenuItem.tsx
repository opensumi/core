import { Item } from 'rc-menu';
import { MenuItemGroupProps } from 'rc-menu/lib/MenuItemGroup';
import React from 'react';

import MenuContext, { MenuContextProps } from './MenuContext';

import { ClickParam } from '.';

// @ts-ignore
export interface MenuItemProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, 'title' | 'onClick' | 'onMouseEnter' | 'onMouseLeave'>,
    MenuItemGroupProps {
  rootPrefixCls?: string;
  disabled?: boolean;
  level?: number;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (param: ClickParam) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  onMouseEnter?: (e: { key: string; domEvent: React.MouseEvent<HTMLElement> }) => void;
  onMouseLeave?: (e: { key: string; domEvent: React.MouseEvent<HTMLElement> }) => void;
  ref?: React.Ref<HTMLElement> | undefined;
}

export default class MenuItem extends React.Component<MenuItemProps> {
  static isMenuItem = true;

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
