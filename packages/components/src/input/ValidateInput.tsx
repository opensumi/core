import classNames from 'classnames';
import React from 'react';

import warning from '../utils/warning';

import { IInputBaseProps, Input } from './Input';

import './validate-input.less';

export enum VALIDATE_TYPE {
  INFO = 1,
  WRANING = 0,
  ERROR = 2,
  WARNING = 3,
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

    warning(
      !validateMessage || validateMessage.type !== VALIDATE_TYPE.WRANING,
      '`VALIDATE_TYPE.WRANING` was a wrong typo, please use `VALIDATE_TYPE.WARNING` instead',
    );

    const validateClx = classNames({
      'validate-error': validateMessage && validateMessage.type === VALIDATE_TYPE.ERROR,
      'validate-warning':
        validateMessage && [VALIDATE_TYPE.WRANING, VALIDATE_TYPE.WARNING].includes(validateMessage.type),
      'validate-info': validateMessage && validateMessage.type === VALIDATE_TYPE.INFO,
    });

    const renderValidateMessage = () => {
      if (validateMessage && validateMessage.message) {
        return <div className={classNames('validate-message', validateClx, { popup })}>{validateMessage.message}</div>;
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
      <div className={classNames('input-box', { popup })}>
        <Input
          type='text'
          ref={ref}
          className={classNames(className, validateMessage, validateClx)}
          onChange={handleChange}
          {...restProps}
        />
        {renderValidateMessage()}
      </div>
    );
  },
);

ValidateInput.displayName = 'ValidateInput';
