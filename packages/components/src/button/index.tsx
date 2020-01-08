import * as React from 'react';
import classNames from 'classnames';

import './style.less';
import { Icon, IconContext } from '../icon';

export type ButtonType = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

export type ButtonHTMLType = 'submit' | 'button' | 'reset';

export type ButtonSize = 'large' | 'default' | 'small';

interface IButtonBasicProps {
  type?: ButtonType;
  iconClass?: string;
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
  iconClass,
  ...otherProps
}) => {
  const { getIcon } = React.useContext(IconContext);
  const classes = classNames('kt-button', className, {
    [`kt-${type}-button-loading`]: loading,
    [`ghost-${type}-button`]: ghost && !loading && type !== 'link',
    [`${type}-button`]: type,
    [`${size}-button-size`]: size,
    ['ghost-button']: ghost && type !== 'link',
    ['block-button']: block,
  });

  const iconNode = iconClass ? <Icon iconClass={iconClass} /> : null;
  return (
    <button {...otherProps} disabled={disabled} className={classes} type={htmlType} onClick={(loading || disabled) ? noop : onClick}>
      {loading && <Icon size={size === 'small' ? 'small' : 'large'} style={{ marginRight: 6 }} loading iconClass={getIcon('sync')} />}
      {iconNode && iconNode}
      {children}
    </button>
  );
};
