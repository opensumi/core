import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';

export const Input: React.FC<{
  insertClass?: string;
  getElement?: (el: HTMLInputElement | null) => void;
  [key: string]: any;
}> = ({ insertClass, getElement, ...restProps }) => {
  // tslint:disable-next-line:no-unused-expression
  return <input ref={(el) => { getElement && getElement(el); }} {...Object.assign({
    spellCheck: false,
    autoCapitalize: 'off',
    autoCorrect: 'off',
  }, restProps)} className={clx(styles.input, insertClass)} />;
};

export enum CheckBoxSize {
  SMALL,
  NORMAL,
}

export const CheckBox: React.FC<{
  id: string,
  insertClass?: string;
  label?: string,
  size?: CheckBoxSize,
  [key: string]: any;
} > = ({ insertClass, label, id, size = CheckBoxSize.NORMAL,  ...restProps }) => {
  return <span className={clx(styles.checkbox_wrap, insertClass, size === CheckBoxSize.SMALL ? styles.small : '')} >
    <input {...restProps} className={clx(styles.checkbox)} id={id} type='checkbox'/>
    <label htmlFor={id}>{label || ''}</label>
  </span>;
};
