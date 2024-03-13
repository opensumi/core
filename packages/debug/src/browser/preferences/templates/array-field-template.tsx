import {
  ArrayFieldTemplateItemType,
  ArrayFieldTemplateProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  getTemplate,
  getUiOptions,
} from '@rjsf/utils';
import cls from 'classnames';
import React from 'react';

import styles from './json-templates.module.less';

export const ArrayFieldTemplate = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: ArrayFieldTemplateProps<T, S, F>,
) => {
  const {
    canAdd,
    className,
    disabled,
    formContext,
    idSchema,
    items,
    onAddClick,
    readonly,
    registry,
    required,
    schema,
    title,
    uiSchema,
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const ArrayFieldDescriptionTemplate = getTemplate<'ArrayFieldDescriptionTemplate', T, S, F>(
    'ArrayFieldDescriptionTemplate',
    registry,
    uiOptions,
  );
  const ArrayFieldItemTemplate = getTemplate<'ArrayFieldItemTemplate', T, S, F>(
    'ArrayFieldItemTemplate',
    registry,
    uiOptions,
  );
  const ArrayFieldTitleTemplate = getTemplate<'ArrayFieldTitleTemplate', T, S, F>(
    'ArrayFieldTitleTemplate',
    registry,
    uiOptions,
  );
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  return (
    <fieldset className={cls(className)} id={idSchema.$id}>
      <div className={styles.array_field_template}>
        {(uiOptions.title || title) && (
          <div className={styles.array_item_label}>
            <ArrayFieldTitleTemplate
              idSchema={idSchema}
              required={required}
              title={uiOptions.title || title}
              schema={schema}
              uiSchema={uiSchema}
              registry={registry}
            />
          </div>
        )}
        {(uiOptions.description || schema.description) && (
          <div className={styles.array_item_description}>
            <ArrayFieldDescriptionTemplate
              description={uiOptions.description || schema.description}
              idSchema={idSchema}
              schema={schema}
              uiSchema={uiSchema}
              registry={registry}
            />
          </div>
        )}
        {items &&
          items.map(({ key, ...itemProps }: ArrayFieldTemplateItemType<T, S, F>) => (
            <ArrayFieldItemTemplate key={key} {...itemProps} />
          ))}

        {canAdd && (
          <div className={styles.array_item_add}>
            <AddButton disabled={disabled || readonly} onClick={onAddClick} registry={registry} />
          </div>
        )}
      </div>
    </fieldset>
  );
};
