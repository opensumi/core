import * as React from 'react';
import { useState, useEffect } from 'react';
import * as classNames from 'classnames';
import { getIcon } from '@ali/ide-core-browser';

import './style.less';
import { Icon } from '../icon';

interface ISelectProps {
  className?: string;
  size?: 'large' | 'default' | 'small';
  opem?: boolean;
  loading?: boolean;
  placeholder?: string;
  options?: string[];
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  [prop: string]: any;
}

export const Select: React.FC<ISelectProps> = ({
  placeholder,
  disabled,
  options,
  size = 'default',
  children,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [select, setSelect] = useState<string | null>(null);

  useEffect(() => {
    if (onChange && select) {
      setOpen(false);
      onChange(select);
    }
  }, [select]);

  function toggleOpen() {
    setOpen(open ? false : true);
  }

  const optionsCotainerClasses = classNames('kt-select-options', {
    ['kt-selecct-options-visible']: open,
    [`kt-select-options-${size}`]: size,
  });

  const selectClasses = classNames('kt-select-value', {
    ['kt-select-disabled']: disabled,
    ['kt-selecct-value-active']: open,
    [`kt-select-value-${size}`]: size,
  });

  return (<div className='kt-select-container'>
    <p className={selectClasses}>
      <option>{value || options && options[0]}</option>
      <Icon iconClass={getIcon('down')} onClick={toggleOpen} />
    </p>

    <div className={optionsCotainerClasses}>
      {options && options.map((v) => {
        if (typeof v === 'string') {
          return <option className={classNames({
            ['kt-select-option-select']: select === v,
          })} onClick={() => setSelect(v)}>{v}</option>;
        }
        return v;
      })}
    </div>
    {children && children}
  </div>);
};
