import {
  ADDITIONAL_PROPERTY_FLAG,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WrapIfAdditionalTemplateProps,
  ADDITIONAL_PROPERTIES_KEY,
  getUiOptions,
  getTemplate,
  titleId,
  descriptionId,
} from '@rjsf/utils';
import React, { FocusEvent, useMemo } from 'react';

import { Input } from '@opensumi/ide-components';
import { formatLocalize, IJSONSchema, localize } from '@opensumi/ide-core-common';

import styles from './json-templates.module.less';

export const WrapIfAdditionalTemplate = <
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(
  props: WrapIfAdditionalTemplateProps<T, S, F>,
) => {
  const {
    children,
    classNames,
    style,
    disabled,
    id,
    label,
    onKeyChange,
    readonly,
    registry,
    required,
    schema,
    uiSchema,
  } = props;
  const { type, properties } = schema;
  const { readonlyAsDisabled = true } = registry.formContext;
  const { templates, translateString } = registry;
  const { RemoveButton, AddButton } = templates.ButtonTemplates;
  const description = schema.description ?? (schema as IJSONSchema).markdownDescription;
  const isPropertiesKey = ADDITIONAL_PROPERTIES_KEY in schema;
  // 如果是用户手动添加 property 则存在该标识
  const isPropertyFlag = ADDITIONAL_PROPERTY_FLAG in schema;

  /**
   * 不存在 additionalProperties 的话直接返回 children
   * 为了防止一些属性的 properties 过多，造成页面过长（比如 node 的 linux 配置项），对于 id 非 root 的配置项让其去 launch 文件处理
   * 二期再将这部分能力加上
   */
  if (!(isPropertiesKey || isPropertyFlag)) {
    return (
      <div className={classNames} style={style}>
        {id === 'root' || type !== 'object' ? children : null}
      </div>
    );
  }

  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );

  const handleBlur = ({ target }: FocusEvent<HTMLInputElement>) => onKeyChange(target.value);
  const isHasPropertiesFlag = useMemo(
    () => properties && Object.values(properties).some((p) => p[ADDITIONAL_PROPERTY_FLAG]),
    [schema, properties],
  );

  const isEmptyProperties = useMemo(() => properties && Object.keys(properties).length === 0, [schema, properties]);

  return (
    <div className={classNames} style={style}>
      <div className={styles.additional_field_template}>
        {label && (
          <TitleFieldTemplate
            id={titleId<T>(id)}
            title={label}
            required={required}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        )}
        {description && (
          <DescriptionFieldTemplate
            id={descriptionId<T>(id)}
            description={description}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        )}
        {
          // 如果不存在 properties 则说明是可以添加任意的 key:value 对象
          !isHasPropertiesFlag && !isEmptyProperties ? (
            <div className={styles.children_field}>
              <div className={styles.dividing}></div>
              <div className={styles.children_container}>{children}</div>
            </div>
          ) : (
            <div className={styles.form_additional_container}>
              <div className={styles.form_additional}>
                {properties &&
                  Object.keys(properties).map((item) => (
                    <div className={styles.form_group}>
                      <Input
                        className={styles.form_control}
                        defaultValue={label}
                        placeholder={formatLocalize('debug.launch.view.template.input.placeholder', 'Key')}
                        disabled={disabled || (readonlyAsDisabled && readonly)}
                        id={`${id}-key`}
                        name={`${id}-key`}
                        onBlur={!readonly ? handleBlur : undefined}
                        type='text'
                      />
                      <Input
                        className={styles.form_control}
                        defaultValue={label}
                        placeholder={formatLocalize('debug.launch.view.template.input.placeholder', 'Value')}
                        disabled={disabled || (readonlyAsDisabled && readonly)}
                        id={`${id}-key`}
                        name={`${id}-key`}
                        onBlur={!readonly ? handleBlur : undefined}
                        type='text'
                      />
                      <RemoveButton className='array-item-remove' disabled={disabled || readonly} registry={registry} />
                    </div>
                  ))}
              </div>
              <div className={styles.form_additional_children}>{children}</div>
            </div>
          )
        }
      </div>
    </div>
  );
};
