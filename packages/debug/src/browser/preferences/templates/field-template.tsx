import {
  FieldTemplateProps,
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  getTemplate,
  getUiOptions,
} from '@rjsf/utils';
import cls from 'classnames';
import React from 'react';

export const FieldTemplate = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: FieldTemplateProps<T, S, F>,
) => {
  const {
    classNames,
    style,
    children,
    id,
    schema,
    label,
    hidden,
    formContext,
    uiSchema,
    registry,
    disabled,
    onDropPropertyClick,
    onKeyChange,
    required,
    readonly,
  } = props;

  const { wrapperStyle } = formContext as GenericObjectType;

  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const WrapIfAdditionalTemplate = getTemplate<'WrapIfAdditionalTemplate', T, S, F>(
    'WrapIfAdditionalTemplate',
    registry,
    uiOptions,
  );

  if (hidden) {
    return null;
  }

  return (
    <WrapIfAdditionalTemplate
      classNames={classNames}
      style={style}
      disabled={disabled}
      id={id}
      label={label}
      onDropPropertyClick={onDropPropertyClick}
      onKeyChange={onKeyChange}
      readonly={readonly}
      required={required}
      schema={schema}
      uiSchema={uiSchema}
      registry={registry}
    >
      {id === 'root' ? (
        children
      ) : (
        <div className={cls(classNames)} style={wrapperStyle}>
          {children}
        </div>
      )}
    </WrapIfAdditionalTemplate>
  );
};
