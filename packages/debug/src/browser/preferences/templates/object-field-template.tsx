import {
  ObjectFieldTemplateProps,
  canExpand,
  StrictRJSFSchema,
  RJSFSchema,
  FormContextType,
  getTemplate,
  getUiOptions,
  descriptionId,
  titleId,
} from '@rjsf/utils';
import React from 'react';

import styles from './json-templates.module.less';

export const ObjectFieldTemplate = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: ObjectFieldTemplateProps<T, S, F>,
) => {
  const {
    schema,
    uiSchema,
    formData,
    onAddClick,
    disabled,
    required,
    readonly,
    registry,
    idSchema,
    title,
    description,
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );

  return (
    <fieldset className={styles.object_field_template}>
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
      {props.properties.map((element) => (
        <div className={styles.property_wrapper}>{React.cloneElement(element.content, { displayLabel: true })}</div>
      ))}
    </fieldset>
  );
};
