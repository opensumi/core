import * as React from 'react';
import * as classNames from 'classnames';

import './style.less';

export const CheckBox: React.FC<{
  id?: string,
  insertClass?: string;
  label?: string,
  size?: 'default' | 'large',
  [key: string]: any;
}> = ({ insertClass, label, id, size = 'default', ...restProps }) => {
  const labelProps: any = {};
  let inputRef: HTMLInputElement;
  if (!id) {
    labelProps.onClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      inputRef.checked = !inputRef.checked;
      const event = new Event('change', { bubbles: true });
      inputRef.dispatchEvent(event);
    };
  }
  const wrapperClasses = classNames('checkbox-wrap', insertClass, {
    ['large-checkbox-wrap']: size === 'large',
  });

  return <span className={wrapperClasses} >
    <input {...restProps} className={'kt-checkbox'} id={id} type='checkbox' ref={(el) => {
      if (el) {
        inputRef = el;
        if (!id && restProps.onChange) {
          inputRef.onchange = (e) => {
            restProps.onChange(e);
          };
        }
      }
    }} />
    <label htmlFor={id} {...labelProps}>{label || ' '}</label>
  </span>;
};
