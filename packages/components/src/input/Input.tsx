import clx from 'classnames';
import React from 'react';

import { Icon } from '../icon';
import warning from '../utils/warning';

import './input.less';

function isUndefined(obj: any): obj is undefined {
  return typeof obj === 'undefined';
}

export interface InputSelection {
  start: number;
  end: number;
}

export interface IInputBaseProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  className?: string;
  autoFocus?: boolean;
  defaultValue?: string;
  wrapperStyle?: React.CSSProperties;
  value?: string;
  onValueChange?: (value: string) => void;
  size?: 'default' | 'large' | 'small';
  disabled?: boolean;
  selection?: InputSelection;
  addonBefore?: React.ReactNode;
  addonAfter?: React.ReactNode;
  /**
   * 处理按下 Enter
   */
  onPressEnter?: React.KeyboardEventHandler<HTMLInputElement>;
  /**
   * @default true
   * 保持 focus，即使点击到 addon 部分
   */
  persistFocus?: boolean;
  /**
   * @default false
   * 是否展示清空按钮
   */
  hasClear?: boolean;
  /**
   * 点击清空之后的回调
   */
  afterClear?: () => void;
  /**
   * @deprecated please use `addonAfter` instead
   */
  controls?: React.ReactNode[];
}

// copied from https://github.com/ant-design/ant-design/blob/master/components/input/Input.tsx#L33
// simulate a Form.ChangeEvent in react.js
function resolveOnChange(
  target: HTMLInputElement,
  e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLElement, MouseEvent>,
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void,
) {
  if (typeof onChange === 'function') {
    let event = e;
    if (e.type === 'click') {
      // click clear icon
      event = Object.create(e);
      event.target = target;
      event.currentTarget = target;
      const originalInputValue = target.value;
      // change target ref value cause e.target.value should be '' when clear input
      target.value = '';
      onChange(event as React.ChangeEvent<HTMLInputElement>);
      // reset target ref value
      target.value = originalInputValue;
      return;
    }
    onChange(event as React.ChangeEvent<HTMLInputElement>);
  }
}

export const Input = React.forwardRef<HTMLInputElement, IInputBaseProps>((props, ref) => {
  const {
    defaultValue,
    className,
    wrapperStyle,
    size = 'default',
    controls,
    onChange,
    selection,
    addonBefore,
    addonAfter,
    persistFocus = true,
    hasClear,
    afterClear,
    value = '',
    onValueChange,
    onPressEnter,
    onKeyDown,
    ...restProps
  } = props;

  warning(!controls, '[@opensumi/ide-components Input]: `controls` was deprecated, please use `addonAfter` instead');

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);

  // handle initial value from `value` or `defaultValue`
  const [inputValue, setInputValue] = React.useState<string>(() => (value ?? defaultValue) || '');
  const [preValue, setPrevValue] = React.useState<string>(() => (value ?? defaultValue) || '');

  // make `ref` to input works
  React.useImperativeHandle(ref, () => inputRef.current!);

  // handle `selection`
  React.useEffect(() => {
    if (selection && !isUndefined(selection.start) && !isDirty) {
      inputRef.current!.setSelectionRange(selection.start, selection.end);
    }
  }, [selection, isDirty]);

  // implements for `getDerivedStateFromProps` to update `state#inputValue` from `props#value`
  React.useEffect(() => {
    // what if value is null??
    // 如果不加这一句的话，后面又会把 inputValue 设置成 null
    if (value === null || typeof value === 'undefined') {
      return;
    }

    if (value !== preValue && value !== inputValue) {
      setInputValue(value);
    }

    // save prev props into state
    if (value !== preValue) {
      setPrevValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerChange(e.target.value);
    resolveOnChange(inputRef.current!, e, onChange);
  };

  const handleClearIconClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    triggerChange('');
    resolveOnChange(inputRef.current!, e, onChange);
    if (typeof afterClear === 'function') {
      afterClear();
    }
  };

  const triggerChange = (value: string) => {
    setInputValue(value);

    if (typeof onValueChange === 'function') {
      onValueChange(value);
    }

    // trigger `dirty` state
    if (!isDirty) {
      setIsDirty(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === 13 && typeof onPressEnter === 'function') {
      onPressEnter(e);
    }
    if (typeof onKeyDown === 'function') {
      onKeyDown(e);
    }
  };

  // addonAfter 优先级高于被废弃的 controls 属性
  const addonAfterNode = addonAfter || controls;

  const persistFocusProps = persistFocus
    ? {
        onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
          e.preventDefault();
        },
      }
    : {};

  const addonRender = (addonNodes: React.ReactNode | undefined, klassName: string) => {
    if (!addonNodes) {
      return null;
    }
    return (
      <div className={clx('kt-input-addon', klassName)} {...persistFocusProps}>
        {React.Children.map(addonNodes, (child) =>
          React.isValidElement(child) ? React.cloneElement(child!, persistFocusProps) : null,
        )}
      </div>
    );
  };

  const inputClx = clx('kt-input', className, {
    [`kt-input-${size}`]: size,
    ['kt-input-disabled']: props.disabled,
  });

  return (
    <div className={inputClx} style={wrapperStyle}>
      {addonRender(addonBefore, 'kt-input-addon-before')}
      <div className='kt-input-box'>
        <input
          ref={inputRef}
          type='text'
          autoCapitalize='off'
          autoCorrect='off'
          autoComplete='off'
          spellCheck={false}
          {...restProps}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {hasClear && inputValue && (
          <Icon
            className='kt-input-clear'
            icon='close-circle-fill'
            onClick={handleClearIconClick}
            {...persistFocusProps}
          />
        )}
      </div>
      {addonRender(addonAfterNode, 'kt-input-addon-after')}
    </div>
  );
});

Input.displayName = 'KTInput';
