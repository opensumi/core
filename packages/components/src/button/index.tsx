import * as React from 'react';
import classNames from 'classnames';

import './style.less';
import Icon from '../icon';
import { getIcon, defaultIconMap } from '@ali/ide-core-browser';

export type ButtonType = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

export type ButtonHTMLType = 'submit' | 'button' | 'reset';

export type ButtonSize = 'large' | 'default' | 'small';

export type IconTypes = keyof typeof defaultIconMap;

interface IButtonBasicProps {
  type?: ButtonType;
  icon?: React.ReactNode & IconTypes;
  className?: string;
  loading?: boolean;
  ghost?: boolean;
  size?: ButtonSize;
  disabled?: boolean;
  block?: boolean;
}

export type ButtonProps = {
  htmlType?: ButtonHTMLType;
  onClick?: React.MouseEventHandler<HTMLElement>
} & IButtonBasicProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'>;

function noop() {}

export const Button: React.FC<ButtonProps> = ({
  children,
  loading,
  className,
  type = 'primary',
  htmlType,
  size,
  ghost = false,
  onClick,
  disabled,
  block,
  ...otherProps
}) => {
  const classes = classNames('kt-button', className, {
    [`kt-${type}-button-loading`]: loading,
    [`ghost-${type}-button`]: ghost && !loading && type !== 'link',
    [`${type}-button`]: type,
    [`${size}-button-size`]: size,
    ['ghost-button']: ghost && type !== 'link',
    ['block-button']: block,
  });

  return (
    <button {...otherProps} disabled={disabled} className={classes} type={htmlType} onClick={(loading || disabled) ? noop : onClick}>
      {loading && <Icon size={size === 'small' ? 'small' : 'large'} style={{ marginRight: 6 }} loading iconClass={getIcon('sync')} />}
      {children}
    </button>
  );
};
