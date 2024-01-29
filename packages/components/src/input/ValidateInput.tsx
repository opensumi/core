import cls from 'classnames';
import React from 'react';

import { IInputBaseProps, Input } from './Input';

import './validate-input.less';

export enum VALIDATE_TYPE {
  INFO = 1,
  ERROR = 2,
  WARNING = 3,
  IGNORE = 4,
}

export interface ValidateMessage {
  message?: string | void;
  type: VALIDATE_TYPE;
}

export interface ValidateInputProp extends IInputBaseProps {
  // void 返回代表验证通过
  // string 代表有错误信息
  validate?: (value: string | number) => ValidateMessage | undefined;
  validateMessage?: ValidateMessage;
  popup?: boolean;
}

export const ValidateInput = React.forwardRef<HTMLInputElement, ValidateInputProp>(
  (
    { type, className, validate, onChange, onValueChange, validateMessage: validateInfo, popup = true, ...restProps },
    ref: React.MutableRefObject<HTMLInputElement>,
  ) => {
    const [validateMessage, setValidateMessage] = React.useState<ValidateMessage | undefined>();

    React.useEffect(() => {
      setValidateMessage(validateInfo);
    }, [validateInfo]);

    const validateClx = cls({
      'validate-error': validateMessage && validateMessage.type === VALIDATE_TYPE.ERROR,
      'validate-warning': validateMessage && validateMessage.type === VALIDATE_TYPE.WARNING,
      'validate-info': validateMessage && validateMessage.type === VALIDATE_TYPE.INFO,
    });

    const renderValidateMessage = () => {
      if (validateMessage && validateMessage.message) {
        return <div className={cls('validate-message', validateClx, { popup })}>{validateMessage.message}</div>;
      }
    };

    const handleChange = (event) => {
      const input: HTMLInputElement = event.target;
      let value;
      if (input.type === 'number') {
        value = event.target.valueAsNumber;
      } else {
        value = event.target.value;
      }
      if (typeof validate === 'function') {
        let message;
        if (type === 'number') {
          if (/^[0-9]+$/.test(value)) {
            message = validate(Number(value));
          } else {
            message = validate(String(value));
          }
        } else {
          message = validate(value);
        }
        setValidateMessage(message);
      }
      if (typeof onChange === 'function') {
        onChange(event);
      }
      if (typeof onValueChange === 'function') {
        onValueChange(value);
      }
    };

    return (
      <div className={cls('input-box', { popup })}>
        <Input
          type={type}
          ref={ref}
          className={cls(className, validateMessage, validateClx)}
          onChange={handleChange}
          {...restProps}
        />
        {renderValidateMessage()}
      </div>
    );
  },
);

ValidateInput.displayName = 'ValidateInput';
