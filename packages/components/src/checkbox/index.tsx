import classNames from 'classnames';
import React from 'react';

import { warning } from '../utils/warning';

import './style.less';

const CheckIconSvg = () => (
  <svg fill='currentColor' width='1em' height='1em' viewBox='0 0 1024 1024' xmlns='http://www.w3.org/2000/svg'>
    <path d='M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474c-6.1-7.7-15.3-12.2-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z' />
  </svg>
);

export const CheckBox: React.FC<
  React.HTMLProps<HTMLInputElement> & {
    insertClass?: string;
    label?: string;
    size?: 'default' | 'large';
    disabled?: boolean;
    // 增加父容器的 tabIndex 属性，以便告诉浏览器这是一个可获取焦点的元素
    // https://stackoverflow.com/questions/42764494/blur-event-relatedtarget-returns-null
    wrapTabIndex?: number;
  }
> = ({ insertClass, className, label, size = 'default', disabled, checked = false, wrapTabIndex, ...restProps }) => {
  warning(!insertClass, '`insertClass` was deprecated, please use `className` instead');

  const cls = classNames('kt-checkbox', insertClass, className, {
    'kt-checkbox-large': size === 'large',
    'kt-checkbox-disabled': disabled,
  });

  return (
    <label className={cls} tabIndex={wrapTabIndex}>
      <span className='kt-checkbox-lump'>
        <input type='checkbox' disabled={disabled} checked={checked} {...restProps} />
        <span className='kt-checkbox-icon'>
          <CheckIconSvg />
        </span>
      </span>
      {label || ' '}
    </label>
  );
};

CheckBox.displayName = 'KTCheckBox';
