import {
  ADDITIONAL_PROPERTY_FLAG,
  FormContextType,
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
  RJSFSchema,
  StrictRJSFSchema,
  canExpand,
  descriptionId,
  getTemplate,
  getUiOptions,
  titleId,
} from '@rjsf/utils';
import cls from 'classnames';
import React, { useCallback, useMemo } from 'react';

import { getIcon } from '@opensumi/ide-components';
import { IJSONSchema, Key, useInjectable } from '@opensumi/ide-core-browser';

import { ILaunchService } from '../../../common/debug-service';
import { LaunchService } from '../launch.service';

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
  const { schema, uiSchema, required, registry, idSchema, title, disabled, readonly, properties, onAddClick } = props;
  const launchService = useInjectable<LaunchService>(ILaunchService);
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

  const description = useMemo(
    () => props.description ?? (schema as IJSONSchema).markdownDescription,
    [props.description, schema],
  );

  const fieldContainerClass = useMemo(
    () =>
      idSchema.$id === 'root'
        ? cls(styles.object_field_container, styles.root_object_field_container)
        : styles.object_field_container,
    [idSchema],
  );

  const propertyWrapperClass = useMemo(
    () =>
      idSchema.$id === 'root' ? cls(styles.property_wrapper, styles.root_property_wrapper) : styles.property_wrapper,
    [idSchema],
  );

  const handleDelProperties = useCallback((node: ObjectFieldTemplatePropertyType) => {
    const { name } = node;
    launchService.delItem(name);
  }, []);

  const renderProperties = useCallback(
    (node: ObjectFieldTemplatePropertyType) => {
      const { rawSchemaProperties: schemaProperties } = launchService;
      if (!schemaProperties) {
        return null;
      }

      const required = schemaProperties.required || [];

      return (
        <div
          key={node.name}
          className={propertyWrapperClass}
          onKeyDown={(event) => {
            if (event.key === Key.ENTER.code) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {node.content}
          {/* 非 root 节点不允许删除 */}
          {required.includes(node.name) || idSchema.$id !== 'root' ? null : (
            <div className={styles.wrapper_delete} onClick={() => handleDelProperties(node)}>
              <span className={cls(getIcon('close-circle'), styles.close_icon)}></span>
            </div>
          )}
        </div>
      );
    },
    [properties, launchService.rawSchemaProperties, idSchema],
  );

  return (
    <div className={styles.object_field_template}>
      <fieldset>
        <div className={fieldContainerClass}>
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
          {properties.filter((e) => !e.hidden).map((element) => renderProperties(element))}
        </div>
        {extendCanExpand<T, S, F>(props) && (
          <AddButton onClick={onAddClick(schema)} disabled={disabled || readonly} registry={registry} />
        )}
      </fieldset>
    </div>
  );
};
