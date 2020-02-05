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
  onClick?: (value: string | number | string[]) => void;
  optionLabelProp?: string;
  disabled?: boolean;
  label?: string | undefined;
}>> = ({
  value,
  children,
  disabled,
  onClick,
  ...otherProps
}) => (
  <option {...otherProps} disabled={disabled} value={value}>{children}</option>
);

function noop(...args: any) { }

function getValueWithProps<P extends { value: any }>(element: React.ReactElement<P>, key?: string) {
  if (key) {
    return element.props[key];
  }
  return element.props.value;
}

function flatChildren(children: React.ReactNode[] | React.ReactNode, warpper) {
  let flatted: React.ReactNode[] = [];
  if (Array.isArray(children)) {
    flatted = React.Children.toArray(children).map(warpper);
  } else {
    flatted = [warpper(children)];
  }
  return flatted;
}

interface MaybeOption {
  value?: string;
  label?: string;
}

function getLabelWithChildrenProps(value: string | undefined, children: React.ReactNode[] | React.ReactNode) {
  const nodes = React.Children.toArray(children).filter((v) => React.isValidElement<MaybeOption>(v)) as React.ReactElement[];

  const currentOption: React.ReactElement<MaybeOption> | null | undefined = nodes.find((node) => {
    if (node.props) {
      if (node.props?.value === value) {
        return node;
      }
    }
    return null;
  });

  return currentOption ? (currentOption.props?.label || currentOption.props?.value) : nodes[0].props?.value;
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
  style,
  className,
}) => {
  const { getIcon } = React.useContext(IconContext);
  const [open, setOpen] = useState(false);
  const [select, setSelect] = useState(value);

  useEffect(() => {
    if (onChange && select && select !== value) {
      onChange(select);
    }
    setOpen(false);
  }, [select]);
  useEffect(() => {
    setSelect(value);
  }, [value]);

  function toggleOpen() {
    setOpen(open ? false : true);
  }

  const optionsContainerClasses = classNames('kt-select-options', {
    ['kt-select-options-visible']: open,
    [`kt-select-options-${size}`]: size,
  });

  const selectClasses = classNames('kt-select-value', {
    ['kt-select-disabled']: disabled,
    ['kt-select-value-active']: open,
    [`kt-select-value-${size}`]: size,
  });

  function Wrapper(node: React.ReactNode) {
    if (typeof node === 'string' || typeof node === 'number') {
      node = <Option value={node} label={String(node)}>{node}</Option>;
    }
    const disabled = (node as React.ReactElement).props?.disabled || false;
    return <div className={classNames({
      ['kt-select-option-select']: select === (node as React.ReactElement).props.value,
    })} onClick={disabled ? noop : () => setSelect(getValueWithProps((node as React.ReactElement), optionLabelProp))}>{node}</div>;
  }

  return (<div className={classNames('kt-select-container', className)}>
    <p className={selectClasses} onClick={toggleOpen} style={style}>
      <option>{(children && getLabelWithChildrenProps(value, children)) || options && (React.isValidElement(options[0]) ? options[0].props?.value : options[0])}</option>
      <Icon iconClass={getIcon('down')} />
    </p>

    <div className={optionsContainerClasses}>
      {options && options.map((v) => {
        if (typeof v === 'string') {
          return <Option value={v} className={classNames({
            ['kt-select-option-select']: select === v,
          })} onClick={() => setSelect(v)}>{v}</Option>;
        }
        return Wrapper(v);
      })}
      {children && flatChildren(children, Wrapper)}
      <div className='kt-select-overlay' onClick={toggleOpen}></div>
    </div>
  </div>);
};
