import { WidgetProps } from '@rjsf/utils';
import React from 'react';

import { Input } from '@opensumi/ide-components';

const INPUT_STYLE = {
  width: '100%',
};

export const TextWidget = (props: WidgetProps) => {
  const { disabled, formContext, id, onBlur, onChange, onFocus, options, placeholder, readonly, schema, value } = props;
  const { readonlyAsDisabled = true } = formContext;

  const handleTextChange = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(target.value === '' ? options.emptyValue : target.value);

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id, target.value);

  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id, target.value);

  return schema.type === 'string' ? (
    <Input
      disabled={disabled || (readonlyAsDisabled && readonly)}
      id={id}
      name={id}
      onBlur={!readonly ? handleBlur : undefined}
      onChange={!readonly ? handleTextChange : undefined}
      onFocus={!readonly ? handleFocus : undefined}
      placeholder={placeholder}
      style={INPUT_STYLE}
      type={(options.inputType || 'text') as string}
      value={value}
      autoComplete='off'
    />
  ) : null;
};
