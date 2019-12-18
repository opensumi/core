import * as React from 'react';
import * as classNames from 'classnames';
import { isUndefined } from '@ali/ide-core-common';

import './style.less';

export interface InputSelection {
  start: number;
  end: number;
}

export interface IInputBaseProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  className?: string;
  autoFocus?: boolean;
  value?: string;
  size?: 'default' | 'large' | 'small';
  disabled?: boolean;
  controls?: React.ReactNode[];
  selection?: InputSelection;
}

const BasicInput: React.FC<IInputBaseProps> = (
  {
    autoFocus,
    className,
    size = 'default',
    disabled,
    controls,
    onChange,
    selection,
    ...otherProps
  },
  ref: React.MutableRefObject<HTMLInputElement>,
) => {
  const classes = classNames('kt-input', className, {
    [`kt-input-${size}`]: size,
    ['kt-input-disabled']: disabled,
  });
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);
  const controlsRef = React.createRef<HTMLDivElement>();
  React.useImperativeHandle(ref, () => inputRef.current!);

  const changeHandler = (event) => {
    if (onChange) {
      onChange(event);
    }
    if (!isDirty) {
      setIsDirty(true);
    }
  };

  React.useEffect(() => {
    if (selection && !isUndefined(selection.start) && !isDirty) {
      inputRef.current!.setSelectionRange(selection.start, selection.end);
    }
  }, [selection, isDirty]);

  React.useEffect(() => {
    if (controlsRef.current) {
      const { width } = controlsRef.current.getBoundingClientRect();
      inputRef.current!.style.paddingRight = `${width}px`;
    }
  }, []);

  const baseInput = () => (<input
    {...otherProps}
    type='text'
    className={classes}
    autoFocus={autoFocus}
    spellCheck={false}
    ref={inputRef}
    onChange={changeHandler}
    autoCapitalize='off'
    autoCorrect='off'
    autoComplete='off'
  />);

  return controls ? (<div className='kt-input-warp'>
    {baseInput()}
    {controls && <div className='kt-input-controls' ref={controlsRef}>{controls}</div>}
  </div>) : baseInput();
};

export const Input = React.forwardRef<HTMLInputElement, IInputBaseProps>(BasicInput);

export interface ITextAreaProps {
  value: string;
}

export const TextArea: React.FC<ITextAreaProps> = () => {
  return <textarea name='' id='' cols={30} rows={10}></textarea>;
};
