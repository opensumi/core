import EllipsisOutlined from '@ant-design/icons/EllipsisOutlined';
import classNames from 'classnames';
import * as React from 'react';

import Button from '../button';
import type { ButtonSize, ButtonType } from '../button';
import type { ButtonHTMLType } from '../button';

import type { DropDownProps } from './dropdown';
import Dropdown from './dropdown';

export interface DropdownButtonProps extends DropDownProps {
  type?: ButtonType;
  size?: ButtonSize;
  htmlType?: ButtonHTMLType;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  icon?: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
  title?: string;
  buttonsRender?: (buttons: React.ReactNode[]) => React.ReactNode[];
}

const DropdownButton: React.FC<DropdownButtonProps> = (props) => {
  const {
    prefixCls: customizePrefixCls,
    type = 'primary',
    size = 'default',
    danger,
    disabled,
    loading,
    onClick,
    htmlType,
    children,
    className,
    overlay,
    trigger,
    align,
    visible,
    onVisibleChange,
    placement,
    getPopupContainer,
    href,
    icon = <EllipsisOutlined />,
    title,
    buttonsRender = (buttons: React.ReactNode[]) => buttons,
    mouseEnterDelay,
    mouseLeaveDelay,
    overlayClassName,
    overlayStyle,
    ...restProps
  } = props;

  const prefixCls = customizePrefixCls || 'kt-dropdown-button';
  const dropdownProps: DropDownProps = {
    align,
    overlay,
    disabled,
    trigger: disabled ? [] : trigger,
    getPopupContainer,
    mouseEnterDelay,
    mouseLeaveDelay,
    overlayClassName,
    overlayStyle,
  };

  dropdownProps.placement = props?.placement ?? 'bottomRight';

  const leftButton = (
    <Button
      size={size}
      type={type}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      htmlType={htmlType}
      title={title}
    >
      {children}
    </Button>
  );

  const rightButton = (
    <Button size={size} type={type}>
      {icon ?? <EllipsisOutlined />}
    </Button>
  );

  const [leftButtonToRender, rightButtonToRender] = buttonsRender([leftButton, rightButton]);

  return (
    <div {...restProps} className={classNames(prefixCls, className)}>
      {leftButtonToRender}
      <Dropdown {...dropdownProps}>{rightButtonToRender}</Dropdown>
    </div>
  );
};

export default DropdownButton;
