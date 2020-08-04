import * as React from 'react';
import { useState, useEffect } from 'react';
import * as classNames from 'classnames';

import './style.less';
import { Icon, getKaitianIcon } from '../icon';

export interface IDataOption<T> {
  iconClass?: string;
  label?: string;
  value: T;
}

export interface IDataOptionGroup<T> {
  iconClass?: string;
  groupName: string;
  options: IDataOption<T>[];
}

export interface ISelectProps<T = string> {
  className?: string;
  size?: 'large' | 'default' | 'small';
  loading?: boolean;
  options?: Array<React.ReactNode > | Array <IDataOption<T>> | IDataOptionGroup<T>[];
  value?: T;
  disabled?: boolean;
  onChange?: (value: T) => void;
  maxHeight?: string;
  [prop: string]: any;
  optionStyle?: any;
  equals?: (v1: T | undefined, v2: T | undefined) => boolean;
  optionRenderer?: React.FC<{ data: IDataOption<T>, isCurrent: boolean }>;
  groupTitleRenderer?: React.FC<{ group: IDataOptionGroup<T>, index: number }>;
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

export function isDataOptions<T = any>(options: Array<React.ReactNode | { label: string, value: T}> | undefined): options is Array<{ label: string, value: T, iconClass?: string}> {
  if (!options) {
    return false;
  }
  if (options.length === 0) {
    return true;
  }
  return isDataOption(options[0]);
}

export function isDataOptionGroups<T = any>(options: Array<React.ReactNode > | Array <IDataOption<T>> | IDataOptionGroup<T>[] | undefined): options is IDataOptionGroup<T>[] {
  if (!options) {
    return false;
  }
  if (options.length === 0) {
    return true;
  }
  return isDataOptionGroup(options[0]);
}

function isDataOption<T = any>(option: React.ReactNode | { label: string, value: T}): option is { label: string, value: T, iconClass?: string} {
  return (option as any).value !== undefined;
}

function isDataOptionGroup<T = any>(option: any): option is IDataOptionGroup<T> {
  return (option as any).groupName !== undefined && isDataOptions((option as any).options);
}

function defaultOptionRenderer<T>(v: { data: IDataOption<T>, isCurrent: boolean}) {
  return <React.Fragment>
            {v.data.iconClass ?
              <div className={classNames(v.data.iconClass, 'kt-select-option-icon')}></div>
              : undefined
            }
            {v.data.label}
        </React.Fragment>;
}

function defaultGroupTitleRenderer<T>({group, index}: {group: IDataOptionGroup<T>, index: number} ) {
  return <div key={'header_' + index} className={'kt-select-group-header'}>
      {group.iconClass ?
            <div className={classNames(group.iconClass, 'kt-select-option-icon')}></div>
            : undefined
        }<div>{group.groupName}</div>
  </div>;
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
  groupTitleRenderer,
}: ISelectProps<T>) {
  const [open, setOpen] = useState(false);

  const selectRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

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
      ['kt-select-option-select']: value === (node as React.ReactElement).props.value,
    })} onClick={disabled ? noop : () => {
      setOpen(false);
      if (onChange) {
        onChange(getValueWithProps((node as React.ReactElement), optionLabelProp));
      }
    }}>{node}</div>;
  }

  useEffect(() => {
    if (selectRef.current && overlayRef.current) {
      const boxRect = selectRef.current.getBoundingClientRect();
      overlayRef.current.style.width = `${boxRect.width}px`;
      overlayRef.current.style.top = `${boxRect.top + boxRect.height}px`;
    }
    if (open) {
      const listener = () => {
        setOpen(false);
      };
      document.addEventListener('click', listener);
      return () => {
        document.removeEventListener('click', listener);
      };
    }
  }, [open]);

  function getSelectedValue() {
    if (options && isDataOptions(options)) {
      for (const option of options) {
        if (equals(value, option.value)) {
          return {
            iconClass: option.iconClass,
            label: option.label,
          };
        }
      }
      return {
        iconClass: options[0]?.iconClass,
        label: options[0]?.label,
      };
    } else if (options && isDataOptionGroups(options)) {
      for (const group of options) {
        for (const option of group.options) {
          if (equals(value, option.value)) {
            return {
              iconClass: option.iconClass,
              label: option.label,
            };
          }
        }
      }
      return {
        iconClass: options[0]?.options[0]?.iconClass,
        label: options[0]?.options[0]?.label,
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
      <Icon iconClass={getKaitianIcon('down')} />
    </p>

    {
      (isDataOptions(options) || isDataOptionGroups(options)) ?
      <SelectOptionsList
        optionRenderer={optionRenderer}
        options={options}
        equals={equals}
        optionStyle={optionStyle}
        currentValue={value}
        size={size}
        onSelect={(value: T) => {
          if (onChange) {
            onChange(value);
          }
          setOpen(false);
        }}
        groupTitleRenderer={groupTitleRenderer}
        className={optionsContainerClasses}
        style={{ maxHeight: `${maxHeight}px` }}
        ref={overlayRef}
      /> :
      // FIXME: to be deprecated
      // 下面这种使用 children 的方式不够标准化，待废弃
      <div className={optionsContainerClasses} style={{ maxHeight: `${maxHeight}px` }} ref={overlayRef}>
        {options && (options as React.ReactNode[]).map((v, i) => {
          return Wrapper(v);
        })}
        {children && flatChildren(children, Wrapper)}
        <div className='kt-select-overlay' onClick={toggleOpen}></div>
      </div>
    }
  </div>);
}

export interface ISelectOptionsListProps<T = string> {
  className?: string;
  size?: 'large' | 'default' | 'small';
  currentValue?: T;
  options: IDataOption<T>[] | IDataOptionGroup<T>[];
  onSelect: (value: T) => void;
  optionStyle?: any;
  equals?: (v1: T | undefined, v2: T | undefined) => boolean;
  optionRenderer?: React.FC<{ data: IDataOption<T>, isCurrent: boolean }>;
  groupTitleRenderer?: React.FC<{ group: IDataOptionGroup<T>, index: number }>;
  style?: any;
  renderCheck?: boolean;
}

export const SelectOptionsList = React.forwardRef(<T, >(props: ISelectOptionsListProps<T>, ref) => {
  const {
    options,
    optionRenderer = defaultOptionRenderer,
    equals = (v1, v2) => v1 === v2,
    onSelect,
    currentValue,
    optionStyle,
    size,
    className,
    style,
    groupTitleRenderer = defaultGroupTitleRenderer,
    renderCheck,
  } = props;

  const optionsContainerClasses = classNames('kt-select-options', {
    [`kt-select-options-${size}`]: true,
  }, className);

  function renderWithGroup(groups: IDataOptionGroup<T>[]) {
    return groups.map((group, index) => {
      const header = groupTitleRenderer({group, index});
      return <React.Fragment key={'group_' + index}>
        {header}
        {renderWithoutGroup(group.options)}
      </React.Fragment>;
    });
  }

  function renderWithoutGroup(options: IDataOption<T>[]) {
    return options && options.map((v, index) => {
      const isCurrent = equals(currentValue, v.value);
      return <Option value={index} key={index} className={classNames({
          ['kt-select-option-select']: isCurrent,
          ['kt-select-option-default']: true,
          ['kt-option-with-check']: renderCheck,
        })} onClick={() => onSelect(v.value)} style={optionStyle}>
          {
            renderCheck && equals(currentValue, v.value) ?  <div className={'kt-option-check'}><Icon icon={'check'} /></div> : undefined
          }
          {optionRenderer({data: v, isCurrent})}
      </Option>;

    });
  }

  return <div className={optionsContainerClasses} style={style} ref={ref} onClick={
    (event) => {
      event.stopPropagation();
    }
  }>
    {
      (isDataOptionGroups(options)) ? renderWithGroup(options) : renderWithoutGroup(options)
    }
  </div>;
});

// @ts-ignore
function usePrevious(value) {
  const ref = React.useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
