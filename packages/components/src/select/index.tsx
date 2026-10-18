import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon, getIcon } from '../icon';
import { Input } from '../input';
import './style.less';

export interface IDataOption<T> {
  iconClass?: string;
  label?: string;
  notMatch?: boolean;
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
  options?: Array<React.ReactNode> | Array<IDataOption<T>> | IDataOptionGroup<T>[];
  value?: T;
  disabled?: boolean;
  onChange?: (value: T) => void;
  onSearchChange?: (value: string) => void;
  /**
   * 搜索行为不采用默认的 filterOptions 进行筛选，由外部托管
   */
  externalSearchBehavior?: boolean;
  /**
   * 当鼠标划过时触发回调
   * @param value 鼠标划过的是第几个 option
   */
  onMouseEnter?: (value: T, index: number) => void;
  maxHeight?: string;
  [prop: string]: any;
  optionStyle?: any;
  equals?: (v1: T | undefined, v2: T | undefined) => boolean;
  optionRenderer?: React.FC<{ data: IDataOption<T>; isCurrent: boolean }>;
  groupTitleRenderer?: React.FC<{ group: IDataOptionGroup<T>; index: number }>;
  headerComponent?: React.FC<any> | React.ComponentClass;
  footerComponent?: React.FC<any> | React.ComponentClass;
  /**
   * 点击时是否启用搜索
   */
  showSearch?: boolean;
  /**
   * 展示选择框提示
   */
  notMatchWarning?: string;
  /**
   * 搜索 placeholder
   */
  searchPlaceholder?: string;
  /**
   * 搜索时，根据输入筛选, 如果showSearch为true，则默认使用 label 判断
   */
  filterOption?: (input: string, options: IDataOption<T>, group?: IDataOptionGroup<T>) => boolean;
  /**
   * 列表为空时的展示组件
   */
  emptyComponent?: React.FC<any>;
  /**
   * 渲染选中项
   */
  selectedRenderer?: React.FC<{ data: IDataOption<T> }> | React.ComponentClass<{ data: IDataOption<T> }>;

  /**
   * 在显示可选项之前的操作
   * 返回 true 表示阻止此次显示
   */
  onBeforeShowOptions?: () => boolean;

  /**
   * 允许 select 的选项框宽度比 select宽度大, 默认 false
   */
  allowOptionsOverflow?: boolean;

  /**
   * 定义选择组件下拉选择菜单的渲染方式
   * fixed —— 相对视窗位置
   * absolute —— 相对于组件位置
   * 默认值为 fixed
   */
  dropdownRenderType?: 'fixed' | 'absolute';

  /**
   * 当前鼠标划过属性的描述信息
   */
  description?: string;
}

export const Option: React.FC<
  React.PropsWithChildren<{
    value: string | number | string[];
    children?: any;
    className?: string;
    onClick?: (value: string | number | string[]) => void;
    optionLabelProp?: string;
    disabled?: boolean;
    label?: string | undefined;
    style?: any;
    containerClassName?: string[];
  }>
> = ({ value, children, disabled, onClick, className, ...otherProps }) => (
  <span
    {...otherProps}
    className={cls(className, { 'kt-option-disabled': disabled })}
    onClick={() => onClick && !disabled && onClick(value)}
  >
    {children}
  </span>
);

function noop(...args: any) {}

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
function getLabelWithChildrenProps<T = string>(
  value: T | undefined,
  children: React.ReactNode[] | React.ReactNode,
  equals: (v1, v2) => boolean = (v1, v2) => v1 === v2,
): MaybeOption | undefined {
  const nodes = React.Children.toArray(children).filter((v) =>
    React.isValidElement<MaybeOption>(v),
  ) as React.ReactElement[];

  const currentOption: React.ReactElement<MaybeOption> | null | undefined = nodes.find((node) => {
    if (node.props) {
      if (equals(node.props?.value, value)) {
        return node;
      }
    }
    return null;
  });

  return currentOption?.props;
}

export function isDataOptions<T = any>(
  options: Array<React.ReactNode | IDataOption<T> | IDataOptionGroup<T>> | undefined,
): options is Array<IDataOption<T>> {
  if (!options) {
    return false;
  }
  if (options.length === 0) {
    return true;
  }
  return isDataOption(options[0]);
}

export function isDataOptionGroups<T = any>(
  options: Array<React.ReactNode> | Array<IDataOption<T>> | IDataOptionGroup<T>[] | undefined,
): options is IDataOptionGroup<T>[] {
  if (!options) {
    return false;
  }
  if (options.length === 0) {
    return true;
  }
  return isDataOptionGroup(options[0]);
}

function isDataOption<T = any>(
  option: React.ReactNode | IDataOption<T> | IDataOptionGroup<T>,
): option is { label: string; value: T; iconClass?: string } {
  return (option as any).value !== undefined;
}

function isDataOptionGroup<T = any>(option: any): option is IDataOptionGroup<T> {
  return (option as any).groupName !== undefined && isDataOptions((option as any).options);
}

function defaultOptionRenderer<T>(v: { data: IDataOption<T>; isCurrent: boolean }) {
  return (
    <React.Fragment>
      {v.data.iconClass ? <div className={cls(v.data.iconClass, 'kt-select-option-icon')}></div> : undefined}
      {v.data.label}
    </React.Fragment>
  );
}

function defaultGroupTitleRenderer<T>({ group, index }: { group: IDataOptionGroup<T>; index: number }) {
  return (
    <div key={'header_' + index} className={'kt-select-group-header'}>
      {group.iconClass ? <div className={cls(group.iconClass, 'kt-select-option-icon')}></div> : undefined}
      <div>{group.groupName}</div>
    </div>
  );
}

function defaultFilterOption<T>(input: string, option: IDataOption<T>) {
  let strToSearch: any = option.label;
  if (strToSearch === undefined) {
    try {
      strToSearch = (option.value as any).toString();
    } catch (e) {
      strToSearch = undefined;
    }
  }
  if (typeof strToSearch === 'string') {
    return strToSearch.indexOf(input) !== -1;
  }
  return false;
}

interface ISelectedContentProps<T = any> {
  selected: IDataOption<T>;
  selectedRenderer?: React.FC<{ data: IDataOption<T> }> | React.ComponentClass<{ data: IDataOption<T> }>;
}

const SelectedContent = React.memo(<T,>({ selected, selectedRenderer: CustomSC }: ISelectedContentProps<T>) => {
  if (CustomSC) {
    return <CustomSC data={selected} />;
  }
  return (
    <>
      {selected.iconClass && <div className={cls(selected.iconClass, 'kt-select-option-icon')} />}
      <span className='kt-select-option'>{selected.label}</span>
    </>
  );
});

const SearchInput = React.memo<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'large' | 'default' | 'small';
}>(({ value, onChange, placeholder, size = 'default' }) => (
  <Input
    className='kt-select-search'
    value={value}
    size={size}
    onChange={(e) => onChange(e.target.value)}
    autoFocus
    placeholder={placeholder || ''}
  />
));

export function Select<T = string>({
  disabled,
  options,
  size = 'default',
  children,
  value,
  onChange,
  onMouseEnter,
  optionLabelProp,
  style,
  optionStyle,
  className,
  maxHeight,
  equals = (v1, v2) => v1 === v2,
  optionRenderer = defaultOptionRenderer,
  groupTitleRenderer,
  footerComponent,
  headerComponent,
  showSearch = false,
  filterOption = defaultFilterOption,
  searchPlaceholder = '',
  emptyComponent,
  selectedRenderer,
  onBeforeShowOptions,
  allowOptionsOverflow,
  dropdownRenderType = 'fixed',
  description,
  notMatchWarning,
  onSearchChange,
  externalSearchBehavior
}: ISelectProps<T>) {
  const [open, setOpen] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState('');

  const selectRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  externalSearchBehavior = externalSearchBehavior ?? !!onSearchChange

  const handleToggleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!open && onBeforeShowOptions?.()) {
        return;
      }
      setOpen(!open);
    },
    [open, onBeforeShowOptions],
  );

  const getSelectedValue = useCallback(() => {
    if (options && isDataOptions(options)) {
      for (const option of options) {
        if (equals(value, option.value)) {
          return {
            iconClass: option.iconClass,
            label: option.label,
            value: option.value,
          };
        }
      }
      return {
        iconClass: options[0]?.iconClass,
        label: options[0]?.label,
        value: options[0]?.value,
      };
    } else if (options && isDataOptionGroups(options)) {
      for (const group of options) {
        for (const option of group.options) {
          if (equals(value, option.value)) {
            return {
              iconClass: option.iconClass,
              label: option.label,
              value: option.value,
            };
          }
        }
      }
      return {
        iconClass: options[0]?.options[0]?.iconClass,
        label: options[0]?.options[0]?.label,
        value: options[0]?.options[0]?.value,
      };
    } else {
      const nodeOption: IDataOption<T> = children && getLabelWithChildrenProps<T>(value, children);
      if (nodeOption) {
        return {
          label: nodeOption.label || (nodeOption.value as any),
          value: nodeOption.value,
        };
      }
    }
    // 如果当前 value 和任何一个 option 都不匹配，返回当前 value
    return {
      label: value as any,
      value: value as any,
      notMatch: true,
    };
  }, [options, value, children]);

  const selected = getSelectedValue();

  const optionsContainerClasses = cls('kt-select-options', {
    ['kt-select-options-visible']: open,
    [`kt-select-options-${size}`]: size,
  });

  const showWarning = notMatchWarning && selected.notMatch;

  const selectClasses = cls('kt-select-value', {
    ['kt-select-warning']: showWarning,
    ['kt-select-disabled']: disabled,
    ['kt-select-value-active']: open,
    [`kt-select-value-${size}`]: size,
  });

  function Wrapper(node: React.ReactNode, index: number) {
    if (!node) {
      return null;
    }

    if (typeof node === 'string' || typeof node === 'number') {
      node = (
        <Option value={node} label={String(node)} key={`${node}_${index}`}>
          {node}
        </Option>
      );
    }

    const element = node as React.ReactElement;
    const disabled = element.props?.disabled || false;

    return (
      <div
        key={`${element.props.value}_${index}`}
        className={cls({
          ['kt-select-option-select']: value === element.props.value,
        })}
        onMouseEnter={() => onMouseEnter?.(element.props.value, index)}
        onClick={
          disabled
            ? noop
            : () => {
                setOpen(false);
                if (onChange) {
                  onChange(getValueWithProps(node as React.ReactElement, optionLabelProp));
                }
              }
        }
      >
        {node}
      </div>
    );
  }

  useEffect(() => {
    if (!open && searchInput) {
      setSearchInput('');
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const updateOverlayPosition = useCallback(() => {
    if (!selectRef.current || !overlayRef.current) {
      return;
    }

    const selectRect = selectRef.current.getBoundingClientRect();
    const overlayEl = overlayRef.current;

    // 设置宽度
    if (allowOptionsOverflow) {
      overlayEl.style.minWidth = `${selectRect.width}px`;
      overlayEl.style.maxWidth = `${window.innerWidth - selectRect.left - 4}px`;
    } else {
      overlayEl.style.width = `${selectRect.width}px`;
    }

    // 计算位置
    const spaceBelow = window.innerHeight - selectRect.bottom - 50;
    const overlayHeight = overlayEl.clientHeight;

    if (spaceBelow < overlayHeight) {
      overlayEl.style.bottom = `${selectRect.height + 4}px`;
    } else {
      overlayEl.style.maxHeight = `${spaceBelow}px`;
      overlayEl.style.bottom = 'auto';
    }

    overlayEl.style.position = dropdownRenderType;
  }, [allowOptionsOverflow, dropdownRenderType]);

  useEffect(() => {
    if (open) {
      updateOverlayPosition();
      window.addEventListener('resize', updateOverlayPosition);
      return () => window.removeEventListener('resize', updateOverlayPosition);
    }
  }, [open, updateOverlayPosition]);

  const filteredOptions = useMemo(() => {
    if (!searchInput) {
      return options;
    }

    if (isDataOptions(options)) {
      return options.filter((o) => filterOption(searchInput, o));
    }

    if (isDataOptionGroups(options)) {
      return options.reduce<IDataOptionGroup<T>[]>((groups, group) => {
        const filteredOpts = group.options.filter((o) => filterOption(searchInput, o, group));
        if (filteredOpts.length) {
          groups.push({
            ...group,
            options: filteredOpts,
          });
        }
        return groups;
      }, []);
    }

    return options;
  }, [options, searchInput, filterOption]);

  const renderSelected = () => (
    <>
      <SelectedContent selected={selected} selectedRenderer={selectedRenderer} />
      <Icon iconClass={cls(getIcon('down'), 'kt-select-value-default-icon')} />
    </>
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      onSearchChange?.(value);
    },
    [searchInput, onSearchChange],
  );

  const renderSearch = () => (
    <SearchInput value={searchInput} onChange={handleSearchChange} placeholder={searchPlaceholder} />
  );

  return (
    <div className={cls('kt-select-container', className)} ref={selectRef}>
      <div className={selectClasses} onClick={handleToggleOpen} style={style}>
        {showSearch && open ? renderSearch() : renderSelected()}
      </div>
      {showWarning && <div className='kt-select-warning-text'>{notMatchWarning}</div>}

      {open &&
        !(externalSearchBehavior && searchInput) &&
        (isDataOptions(filteredOptions) || isDataOptionGroups(filteredOptions) ? (
          <SelectOptionsList
            optionRenderer={optionRenderer}
            options={filteredOptions}
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
            footerComponent={footerComponent}
            headerComponent={headerComponent}
            emptyComponent={emptyComponent}
          />
        ) : (
          // FIXME: to be deprecated
          // 下面这种使用 children 的方式不够标准化，待废弃
          <div className={optionsContainerClasses} style={{ maxHeight: `${maxHeight}px` }} ref={overlayRef}>
            {options && (options as React.ReactNode[]).map((v, i) => Wrapper(v, i))}
            {children && flatChildren(children, Wrapper)}
            {description && <Description text={description} />}
            <div className='kt-select-overlay' onClick={handleToggleOpen}></div>
          </div>
        ))}
    </div>
  );
}

function Description({ text }: { text: string }) {
  return (
    <>
      <div className='kt-option-divider' />
      <div className='kt-option-description'>{text}</div>
    </>
  );
}

export interface ISelectOptionsListProps<T = string> {
  className?: string;
  size?: 'large' | 'default' | 'small';
  currentValue?: T;
  options: IDataOption<T>[] | IDataOptionGroup<T>[];
  onSelect: (value: T) => void;
  optionStyle?: any;
  equals?: (v1: T | undefined, v2: T | undefined) => boolean;
  optionRenderer?: React.FC<{ data: IDataOption<T>; isCurrent: boolean }>;
  groupTitleRenderer?: React.FC<{ group: IDataOptionGroup<T>; index: number }>;
  style?: any;
  renderCheck?: boolean;
  headerComponent?: React.FC<any> | React.ComponentClass;
  footerComponent?: React.FC<any> | React.ComponentClass;
  emptyComponent?: React.FC<any> | React.ComponentClass;
}

export const SelectOptionsList = React.forwardRef(<T,>(props: ISelectOptionsListProps<T>, ref) => {
  const {
    options,
    optionRenderer: OPC = defaultOptionRenderer,
    equals = (v1, v2) => v1 === v2,
    onSelect,
    currentValue,
    optionStyle,
    size,
    className,
    style,
    groupTitleRenderer: GT = defaultGroupTitleRenderer,
    renderCheck,
    headerComponent: HC,
    footerComponent: FC,
    emptyComponent: EC,
  } = props;
  const optionsContainerClasses = cls(
    'kt-select-options',
    {
      [`kt-select-options-${size}`]: true,
    },
    className,
  );

  function renderWithGroup(groups: IDataOptionGroup<T>[]) {
    return groups.map((group, index) => {
      const header = <GT group={group} index={index} />;
      return (
        <React.Fragment key={'group_' + index}>
          {header}
          {renderWithoutGroup(group.options)}
        </React.Fragment>
      );
    });
  }

  function renderWithoutGroup(options: IDataOption<T>[]) {
    return (
      options &&
      options.map((v, index) => {
        const isCurrent = equals(currentValue, v.value);
        return (
          <Option
            value={index}
            key={index}
            className={cls({
              ['kt-select-option-select']: isCurrent,
              ['kt-select-option-default']: true,
              ['kt-option-with-check']: renderCheck,
            })}
            onClick={() => onSelect(v.value)}
            style={optionStyle}
          >
            {renderCheck && equals(currentValue, v.value) ? (
              <div className={'kt-option-check'}>
                <Icon icon={'check'} />
              </div>
            ) : undefined}
            <OPC data={v} isCurrent={isCurrent} />
          </Option>
        );
      })
    );
  }

  let isEmpty: boolean;
  if (isDataOptionGroups(options)) {
    isEmpty = options.filter((group) => group.options.length > 0).length === 0;
  } else {
    isEmpty = options.length === 0;
  }

  return (
    <div
      className={optionsContainerClasses}
      style={style}
      ref={ref}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {HC ? <HC /> : null}
      {isEmpty && EC ? (
        <EC />
      ) : (
        (isDataOptionGroups(options) ? renderWithGroup(options) : renderWithoutGroup(options)) || (EC && <EC />)
      )}
      {FC ? <FC /> : null}
    </div>
  );
});
