import * as React from 'react';
import { useState, useEffect } from 'react';
import * as classNames from 'classnames';

import './style.less';
import { Icon, IconContext } from '../icon';

interface ISelectProps {
  className?: string;
  size?: 'large' | 'default' | 'small';
  opem?: boolean;
  loading?: boolean;
  placeholder?: string;
  options?: Array<React.ReactNode>;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  [prop: string]: any;
}

export const Option: React.FC<React.PropsWithChildren<{
  value: string | number | string[];
  children?: any;
  className?: string;
  onClick?: () => void;
  optionLabelProp?: string;
}>> = ({
  value,
  children,
  ...otherProps
}) => (
  <option {...otherProps} value={value}>{children}</option>
);

function getValueWithProps<P extends { value: any }>(element: React.ReactElement<P>, key?: string) {
  if (key) {
    return element.props[key];
  }
  return element.props.value;
}

export const Select: React.FC<ISelectProps> = ({
  placeholder,
  disabled,
  options,
  size = 'default',
  children,
  value,
  onChange,
  optionLabelProp,
}) => {
  const { getIcon } = React.useContext(IconContext);
  const [open, setOpen] = useState(false);
  const [select, setSelect] = useState<string | null>(null);

  useEffect(() => {
    if (onChange && select) {
      onChange(select);
    }
    setOpen(false);
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
    <p className={selectClasses} onClick={toggleOpen}>
      <option>{value || options && options[0]}</option>
      <Icon iconClass={getIcon('down')} />
    </p>

    <div className={optionsCotainerClasses}>
      {options && options.map((v) => {
        if (typeof v === 'string') {
          return <Option value={v} className={classNames({
            ['kt-select-option-select']: select === v,
          })} onClick={() => setSelect(v)}>{v}</Option>;
        }
        return <div className={classNames({
          ['kt-select-option-select']: select === (v as React.ReactElement).props.value,
        })} onClick={() => setSelect(getValueWithProps((v as React.ReactElement), optionLabelProp))}>{v}</div>;
      })}
      <div className='kt-select-overlay' onClick={toggleOpen}></div>
    </div>
    {children && children}
  </div>);
};
