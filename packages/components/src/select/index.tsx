import * as React from 'react';
import { useState, useEffect } from 'react';
import * as classNames from 'classnames';

import './style.less';
import { Icon, getDefaultIcon } from '../icon';

export interface ISelectProps<T = string> {
  className?: string;
  size?: 'large' | 'default' | 'small';
  loading?: boolean;
  options?: Array<React.ReactNode | { iconClass?: string, label?: string, value: T} >;
  groupSplits?: {[beforeIndex: number]: string};
  value?: T;
  disabled?: boolean;
  onChange?: (value: T) => void;
  maxHeight?: string;
  [prop: string]: any;
  optionStyle?: any;
  equals?: (v1: T | undefined, v2: T | undefined) => boolean;
  optionRenderer?: React.FC<{ iconClass?: string, label?: string, value: T, index: number, setSelect: (v: T) => void, isCurrent: boolean, style: any}>;
  splitRenderer?: React.FC<{ groupName: string, beforeIndex: number}>;
}

export const Option: React.FC<React.PropsWithChildren<{
  value: string | number | string[];
  children?: any;
  className?: string;
  onClick?: (value: string | number | string[]) => void;
  optionLabelProp?: string;
  disabled?: boolean;
  label?: string | undefined;
  style?: any
}>> = ({
  value,
  children,
  disabled,
  onClick,
  className,
  ...otherProps
}) => (
  <span {...otherProps} className={classNames(className, { 'kt-option-disabled': disabled })} onClick={() => onClick && !disabled && onClick(value)}>{children}</span>
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

/**
 * @deprecated
 * 从react node 上获取 props 来比较有点反模式，不符合数据和视图解耦的思想
 */
function getLabelWithChildrenProps<T = string>(value: T | undefined, children: React.ReactNode[] | React.ReactNode, equals: (v1, v2) => boolean = (v1, v2) => v1 === v2) {
  const nodes = React.Children.toArray(children).filter((v) => React.isValidElement<MaybeOption>(v)) as React.ReactElement[];

  const currentOption: React.ReactElement<MaybeOption> | null | undefined = nodes.find((node) => {
    if (node.props) {
      if (equals(node.props?.value, value)) {
        return node;
      }
    }
    return null;
  });

  return currentOption ? (currentOption.props?.label || currentOption.props?.value) : nodes[0].props?.value;
}

function isDataOptions<T = any>(options: Array<React.ReactNode | { label: string, value: T}>): options is Array<{ label: string, value: T, iconClass?: string}> {
  if (options.length === 0) {
    return true;
  }
  return isDataOption(options[0]);
}

function isDataOption<T = any>(option: React.ReactNode | { label: string, value: T}): option is { label: string, value: T, iconClass?: string} {
  return (option as any).value !== undefined;
}
function defaultOptionRenderer<T>(v: { iconClass?: string, label?: string, value: T, index: number, setSelect: (v: T) => void, isCurrent: boolean, style: any}) {
 return <Option value={v.index} key={v.index} className={classNames({
          ['kt-select-option-select']: v.isCurrent,
          ['kt-select-option-default']: true,
        })} onClick={() => v.setSelect(v.value)} style={v.style}>
          {v.iconClass ?
            <div className={classNames(v.iconClass, 'kt-select-option-icon')}></div>
            : undefined
          }
          {v.label}
        </Option>;
}

export function Select<T = string>({
  disabled,
  options,
  size = 'default',
  children,
  value,
  onChange,
  optionLabelProp,
  style,
  optionStyle,
  className,
  maxHeight,
  equals = (v1, v2) => v1 === v2,
  optionRenderer = defaultOptionRenderer,
}: ISelectProps<T>) {
  const [open, setOpen] = useState(false);
  if (options && isDataOptions(options)) {
    const index = options.findIndex((option) => equals(option.value, value));
    if (index === -1) {
      value = options[0]?.value;
    }
  }
  const [select, setSelect] = useState<T | undefined>(value);
  const selectRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (onChange && select !== undefined) {
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
    return <div key={(node as React.ReactElement).props.value} className={classNames({
      ['kt-select-option-select']: select === (node as React.ReactElement).props.value,
    })} onClick={disabled ? noop : () => setSelect(getValueWithProps((node as React.ReactElement), optionLabelProp))}>{node}</div>;
  }

  useEffect(() => {
    if (selectRef.current && overlayRef.current) {
      const boxRect = selectRef.current.getBoundingClientRect();
      overlayRef.current.style.width = `${boxRect.width}px`;
      overlayRef.current.style.top = `${boxRect.top + boxRect.height}px`;
    }
  }, [open]);

  function getSelectedValue() {
    if (options && isDataOptions(options)) {
      for (const option of options) {
        if (equals(select, option.value)) {
          return {
            iconClass: option.iconClass,
            label: option.label,
          };
        }
      }
      return {
        iconClass: options[0].iconClass,
        label: options[0].label,
      };
    } else {
      const text = children && getLabelWithChildrenProps<T>(value, children);
      if (text) {
        return {
          label: text,
        };
      }
    }
    return {
      label: '',
    };
  }

  const selected = getSelectedValue();

  return (<div className={classNames('kt-select-container', className)} ref={selectRef}>
    <p className={selectClasses} onClick={toggleOpen} style={style}>
      {selected.iconClass ? <span className={classNames(selected.iconClass, 'kt-select-option-icon')}></span> : undefined}
      <span className={'kt-select-option'}>{selected.label}</span>
      <Icon iconClass={getDefaultIcon('down')} />
    </p>

    <div className={optionsContainerClasses} style={{ maxHeight: `${maxHeight}px` }} ref={overlayRef}>
      {options && options.map((v, i) => {
        if (isDataOption<T>(v)) {
          return optionRenderer({...v, isCurrent: equals(select, v.value), index: i, setSelect: (value) => {
            setSelect(value);
            setOpen(false);
          }, style: optionStyle});
        }
        return Wrapper(v);
      })}
      {children && flatChildren(children, Wrapper)}
      <div className='kt-select-overlay' onClick={toggleOpen}></div>
    </div>
  </div>);
}
