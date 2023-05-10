import {
  ObjectFieldTemplateProps,
  StrictRJSFSchema,
  RJSFSchema,
  FormContextType,
  getTemplate,
  getUiOptions,
  descriptionId,
  titleId,
  canExpand,
} from '@rjsf/utils';
import React from 'react';

import { Button, getIcon } from '@opensumi/ide-components';
import { defaultIconfont } from '@opensumi/ide-components/lib/icon/iconfont/iconMap';

import styles from './json-templates.module.less';

export const ObjectFieldTemplate = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: ObjectFieldTemplateProps<T, S, F>,
) => {
  const {
    schema,
    uiSchema,
    required,
    registry,
    idSchema,
    title,
    description,
    disabled,
    readonly,
    properties,
    formData,
    onAddClick,
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  return (
    <div className={styles.object_field_template}>
      <fieldset>
        <div className={styles.container_field}>
          {title && (
            <div className={styles.object_title}>
              <TitleFieldTemplate
                id={titleId<T>(idSchema)}
                title={title}
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
                id={descriptionId<T>(idSchema)}
                description={description}
                schema={schema}
                uiSchema={uiSchema}
                registry={registry}
              />
            </div>
          )}
          {properties
            .filter((e) => !e.hidden)
            .map((element) => (
              <div key={element.name} className={styles.property_wrapper}>
                {element.content}
              </div>
            ))}
        </div>
        {canExpand<T, S, F>(schema, uiSchema, formData) && (
          <AddButton
            className='object-property-expand'
            onClick={onAddClick(schema)}
            disabled={disabled || readonly}
            registry={registry}
          />
        )}
      </fieldset>
    </div>
  );
};
