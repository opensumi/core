import {
  descriptionId,
  FormContextType,
  GenericObjectType,
  getTemplate,
  RJSFSchema,
  StrictRJSFSchema,
  titleId,
  WidgetProps,
} from '@rjsf/utils';
import React, { useMemo } from 'react';

import { Input } from '@opensumi/ide-components';

import { parseSnippet } from '../../debugUtils';

import styles from './json-widget.module.less';

export const TextWidget = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: WidgetProps<T, S, F>,
) => {
  const {
    disabled,
    formContext,
    id,
    onBlur,
    onChange,
    onFocus,
    options,
    placeholder,
    readonly,
    schema,
    value,
    registry,
    label,
    hideLabel,
    required,
    uiSchema,
    uiOptions,
  } = props;
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;

  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );

  const parseValue = useMemo(() => {
    if (typeof value !== 'string') {
      return value;
    }

    return parseSnippet(value);
  }, [value]);

  const handleTextChange = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(target.value === '' ? options.emptyValue : target.value);

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id, target.value);

  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id, target.value);

  const type = useMemo(() => {
    if (schema.type !== 'string' && schema.type !== 'number') {
      return 'string';
    }

    return schema.type;
  }, [schema, schema.type]);

  const description = useMemo(() => schema.description || '', [schema, schema.description]);

  return (
    <div>
      {!hideLabel && label && (
        <div className={styles.object_title}>
          <TitleFieldTemplate
            id={titleId<T>(id)}
            title={label}
            required={required}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        </div>
      )}
      {description && (
        <div className={styles.object_description}>
          <DescriptionFieldTemplate
            id={descriptionId<T>(id)}
            description={description}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        </div>
      )}
      <Input
        disabled={disabled || (readonlyAsDisabled && readonly)}
        id={id}
        name={id}
        onBlur={!readonly ? handleBlur : undefined}
        onChange={!readonly ? handleTextChange : undefined}
        onFocus={!readonly ? handleFocus : undefined}
        placeholder={placeholder}
        type={type}
        value={parseValue}
        className={styles.text_widget_control}
        autoComplete='off'
      />
    </div>
  );
};
