import {
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
  ariaDescribedByIds,
  getTemplate,
} from '@rjsf/utils';
import React, { FocusEvent } from 'react';

import { CheckBox } from '@opensumi/ide-components';
import { IJSONSchema } from '@opensumi/ide-core-common';

import styles from './json-widget.module.less';

export const CheckboxWidget = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: WidgetProps<T, S, F>,
) => {
  const {
    disabled,
    formContext,
    id,
    label,
    hideLabel,
    onBlur,
    onChange,
    onFocus,
    readonly,
    value,
    registry,
    options,
    schema,
    uiSchema,
  } = props;
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    options,
  );

  const handleChange = ({ target }: any) => onChange(target.checked);

  const handleBlur = ({ target }: FocusEvent<HTMLInputElement>) => onBlur(id, target.checked);

  const handleFocus = ({ target }: FocusEvent<HTMLInputElement>) => onFocus(id, target.checked);

  const extraProps = {
    onBlur: !readonly ? handleBlur : undefined,
    onFocus: !readonly ? handleFocus : undefined,
  };

  const description = options.description ?? schema.description ?? (schema as IJSONSchema).markdownDescription;

  return (
    <div className={styles.checkbox_widget_control}>
      {!hideLabel && (
        <label title={label} className={styles.field_label}>
          {label}
        </label>
      )}
      <CheckBox
        checked={typeof value === 'undefined' ? false : value}
        disabled={disabled || (readonlyAsDisabled && readonly)}
        id={id}
        name={id}
        onChange={!readonly ? handleChange : undefined}
        {...extraProps}
        aria-describedby={ariaDescribedByIds<T>(id)}
        label={description}
        className={styles.checkbox}
      />
    </div>
  );
};
