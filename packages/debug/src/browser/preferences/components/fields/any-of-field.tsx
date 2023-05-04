import React from 'react';

import { Input } from '@opensumi/ide-components';

import styles from '../json-widget.module.less';

// 对于 anyof 的处理统一使用 input
export const AnyOfField = (props) => {
  const { disabled, formContext, id, onBlur, onChange, onFocus, options, placeholder, readonly, schema, value } = props;
  const { readonlyAsDisabled = true } = formContext;

  const handleTextChange = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(target.value === '' ? options.emptyValue : target.value);

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id, target.value);

  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id, target.value);

  return (
    <Input
      disabled={disabled || (readonlyAsDisabled && readonly)}
      id={id}
      name={id}
      onBlur={!readonly ? handleBlur : undefined}
      onChange={!readonly ? handleTextChange : undefined}
      onFocus={!readonly ? handleFocus : undefined}
      placeholder={placeholder}
      className={styles.any_of_widget_control}
      autoComplete='off'
    />
  );
};
