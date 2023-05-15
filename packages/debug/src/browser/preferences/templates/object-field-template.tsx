import {
  ObjectFieldTemplateProps,
  StrictRJSFSchema,
  RJSFSchema,
  FormContextType,
  getTemplate,
  getUiOptions,
  descriptionId,
  canExpand,
  titleId,
  ADDITIONAL_PROPERTY_FLAG,
} from '@rjsf/utils';
import React from 'react';

import styles from './json-templates.module.less';

/**
 * 情况一: properties 为空则表明该属性的值是任意的 key:value 对象组合，所以需要显示添加按钮
 * 情况二: 如果 properties 当中存在 ADDITIONAL_PROPERTY_FLAG 字段，则允许继续添加
 */
const extendCanExpand = <T, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: ObjectFieldTemplateProps<T, S, F>,
) => {
  const { schema, uiSchema, formData } = props;
  const { properties } = schema;

  if (!properties) {
    return false;
  }

  if (Object.keys(properties).length === 0) {
    return true;
  }

  if (!Object.values(properties).some((item) => item[ADDITIONAL_PROPERTY_FLAG])) {
    return false;
  }

  return canExpand(schema, uiSchema, formData);
};

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
        <div className={styles.object_field_container}>
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
        {extendCanExpand<T, S, F>(props) && (
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
