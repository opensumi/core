import * as React from 'react';
import * as cls from 'classnames';

import * as styles from './styles.module.less';

export interface InputSelection {
  start: number;
  end: number;
}

export enum VALIDATE_TYPE {
  INFO,
  WRANING,
  ERROR,
}

export interface ValidateMessage {
  message: string | void;
  type: VALIDATE_TYPE;
}
export interface ValidateInputProp extends InputProp {
  // void 返回代表验证通过
  // string 代表有错误信息
  validate: (value: string) => ValidateMessage;
}

export interface InputProp extends React.InputHTMLAttributes<HTMLInputElement> {
  // 选中范围
  selection: InputSelection;
}

const PureInput: React.FC<InputProp> = (
  { className, autoFocus, selection, ...restProps },
  ref: React.MutableRefObject<HTMLInputElement>,
) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useImperativeHandle(ref, () => inputRef.current!);

  React.useEffect(() => {
    inputRef.current!.setSelectionRange(selection.start, selection.end);
  }, [selection]);

  return (
    <input
      type='text'
      className={cls(styles.input, className)}
      ref={inputRef}
      autoFocus={autoFocus}
      spellCheck={false}
      autoCapitalize='off'
      autoCorrect='off'
      autoComplete='off'
      {...restProps}
    />
  );
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(PureInput);

export enum CheckBoxSize {
  SMALL,
  NORMAL,
}

export const CheckBox: React.FC<{
  id: string,
  insertClass?: string;
  label?: string,
  size?: CheckBoxSize,
  [key: string]: any;
} > = ({ insertClass, label, id, size = CheckBoxSize.NORMAL,  ...restProps }) => {
  return <span className={cls(styles.checkbox_wrap, insertClass, size === CheckBoxSize.SMALL ? styles.small : '')} >
    <input {...restProps} className={cls(styles.checkbox)} id={id} type='checkbox'/>
    <label htmlFor={id}>{label || ''}</label>
  </span>;
};

export const ValidateInput: React.FC<ValidateInputProp> = (
  { className, autoFocus, validate, onChange, ...restProps },
  ref: React.MutableRefObject<HTMLInputElement>,
) => {
  const [validateMessage, setValidateMessage] = React.useState<ValidateMessage>();

  const renderValidateMessage = () => {
    if (validateMessage && validateMessage.message) {
      return <div
        className={cls(styles.validate_message, validateMessage.type === VALIDATE_TYPE.ERROR ? styles.error : validateMessage.type === VALIDATE_TYPE.WRANING ? styles.wraning : styles.info)}
      >
        {validateMessage.message}
      </div>;
    }
  };
  const onChangeHandler = (event) => {
    if (typeof validate === 'function') {
      const message = validate(event.target.value);
      setValidateMessage(message);
    }
    if (typeof onChange === 'function') {
      onChange(event);
    }
  };

  return <div className={styles.input_box}>
    <Input
      type='text'
      className={cls(styles.input, validateMessage && (validateMessage.type === VALIDATE_TYPE.ERROR ? styles.error : validateMessage.type === VALIDATE_TYPE.WRANING ? styles.wraning : styles.info), className)}
      autoFocus={autoFocus}
      spellCheck={false}
      onChange={onChangeHandler}
      autoCapitalize='off'
      autoCorrect='off'
      {...restProps}
    />
    {renderValidateMessage()}
  </div>;
};
