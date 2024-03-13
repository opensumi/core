import {
  FieldProps,
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  descriptionId,
  getTemplate,
  titleId,
} from '@rjsf/utils';
import React from 'react';

import { Input } from '@opensumi/ide-components';
import { IJSONSchema } from '@opensumi/ide-core-common';

import styles from '../json-widget.module.less';

// 对于 anyof/oneof 的处理统一使用 input
export const AnyOfField = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: FieldProps<T, S, F>,
) => {
  const {
    disabled,
    formContext,
    idSchema,
    onBlur,
    id,
    onChange,
    onFocus,
    options,
    placeholder,
    readonly,
    registry,
    name,
    required,
    schema,
    uiOptions,
  } = props;
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;

  const handleTextChange = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(target.value === '' ? options.emptyValue : target.value);

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id!, target.value);

  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id!, target.value);

  const description = options.description ?? schema.description ?? (schema as IJSONSchema).markdownDescription;

  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );

  return (
    <div className={styles.any_of_widget_control}>
      {name && (
        <div className={styles.object_title}>
          <TitleFieldTemplate
            id={titleId<T>(idSchema)}
            title={name}
            required={required}
            schema={schema}
            registry={registry}
          />
        </div>
      )}
      {description && (
        <div className={styles.object_description}>
          <DescriptionFieldTemplate
            id={descriptionId<T>(idSchema)}
            description={description}
            schema={schema}
            registry={registry}
          />
        </div>
      )}
      <Input
        disabled={disabled || (readonlyAsDisabled && readonly)}
        onBlur={!readonly ? handleBlur : undefined}
        onChange={!readonly ? handleTextChange : undefined}
        onFocus={!readonly ? handleFocus : undefined}
        placeholder={placeholder}
        autoComplete='off'
      />
    </div>
  );
};
