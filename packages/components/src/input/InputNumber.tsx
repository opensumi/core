import type { ValueType } from '@rc-component/mini-decimal';
import clx from 'classnames';
import type { InputNumberProps as RcInputNumberProps } from 'rc-input-number';
import RcInputNumber from 'rc-input-number';
import React from 'react';

import './input.less';
import './input-number.less';

export interface InputNumberProps<T extends ValueType = ValueType>
  extends Omit<RcInputNumberProps<T>, 'prefix' | 'size' | 'controls'> {
  size?: 'default' | 'large' | 'small';
  wrapperStyle?: React.CSSProperties;
}

const prefix = 'kt-input-number';

export const InputNumber: React.FC<InputNumberProps> = (props: InputNumberProps) => {
  const { value, size = 'default', wrapperStyle, className, disabled, min, max, onChange, ...restProps } = props;

  const onRcChange = (val: number) => {
    if (onChange) {
      onChange(val);
    }
  };

  const inputClx = clx('kt-input', 'kt-input-number', className, {
    [`kt-input-${size}`]: size,
    ['kt-input-disabled']: disabled,
  });

  return (
    <div className={inputClx} style={wrapperStyle}>
      <div className='kt-input-box'>
        <RcInputNumber
          prefixCls={prefix}
          min={min}
          max={max}
          value={value}
          type='number'
          onChange={onRcChange}
          controls={true}
          {...restProps}
        ></RcInputNumber>
      </div>
    </div>
  );
};

InputNumber.displayName = 'OpenSumiInputNumber';
