import {
  BaseInputTemplateProps,
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  ariaDescribedByIds,
  examplesId,
  getInputProps,
} from '@rjsf/utils';
import React, { ChangeEvent, FocusEvent } from 'react';

import { Input } from '@opensumi/ide-components';

const INPUT_STYLE = {
  width: '100%',
};

export const BaseInputTemplate = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: BaseInputTemplateProps<T, S, F>,
) => {
  const {
    disabled,
    formContext,
    id,
    onBlur,
    onChange,
    onChangeOverride,
    onFocus,
    options,
    placeholder,
    readonly,
    schema,
    value,
    type,
  } = props;
  const inputProps = getInputProps<T, S, F>(schema, type, options, false);
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;

  const handleNumberChange = (nextValue: number | null) => onChange(nextValue);

  const handleTextChange = onChangeOverride
    ? onChangeOverride
    : ({ target }: ChangeEvent<HTMLInputElement>) => onChange(target.value === '' ? options.emptyValue : target.value);

  const handleBlur = ({ target }: FocusEvent<HTMLInputElement>) => onBlur(id, target.value);

  const handleFocus = ({ target }: FocusEvent<HTMLInputElement>) => onFocus(id, target.value);

  const input = (
    <Input
      disabled={disabled || (readonlyAsDisabled && readonly)}
      id={id}
      name={id}
      onBlur={!readonly ? handleBlur : undefined}
      onChange={!readonly ? handleTextChange : undefined}
      onFocus={!readonly ? handleFocus : undefined}
      placeholder={placeholder}
      style={INPUT_STYLE}
      list={schema.examples ? examplesId<T>(id) : undefined}
      {...inputProps}
      value={value}
      aria-describedby={ariaDescribedByIds<T>(id, !!schema.examples)}
    />
  );

  return (
    <>
      {input}
      {Array.isArray(schema.examples) && (
        <datalist id={examplesId<T>(id)}>
          {(schema.examples as string[])
            .concat(schema.default && !schema.examples.includes(schema.default) ? ([schema.default] as string[]) : [])
            .map((example) => (
              <option key={example} value={example} />
            ))}
        </datalist>
      )}
    </>
  );
};
