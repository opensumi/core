import PropTypes from 'prop-types';
import { SubMenu as RcSubMenu, SubMenuProps as RCSubMenuProps } from 'rc-menu';
import React from 'react';

interface TitleEventEntity {
  key: string;
  domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>;
}

export interface SubMenuProps extends RCSubMenuProps {
  rootPrefixCls?: string;
  className?: string;
  disabled?: boolean;
  title?: React.ReactNode;
  style?: React.CSSProperties;
  onTitleClick?: (e: TitleEventEntity) => void;
  onTitleMouseEnter?: (e: TitleEventEntity) => void;
  onTitleMouseLeave?: (e: TitleEventEntity) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  popupOffset?: [number, number];
  popupClassName?: string;
}

class SubMenu extends React.Component<SubMenuProps, any> {
  static contextTypes = {
    antdMenuTheme: PropTypes.string,
  };

  // fix issue:https://github.com/ant-design/ant-design/issues/8666
  static isSubMenu = 1;

  render() {
    const { popupClassName } = this.props;
    return <RcSubMenu {...this.props} popupClassName={popupClassName} />;
  }
}

export default SubMenu;
