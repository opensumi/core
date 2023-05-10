import {
  ADDITIONAL_PROPERTY_FLAG,
  UI_OPTIONS_KEY,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WrapIfAdditionalTemplateProps,
  ADDITIONAL_PROPERTIES_KEY,
  getUiOptions,
  getTemplate,
  PROPERTIES_KEY,
  titleId,
  descriptionId,
} from '@rjsf/utils';
import React, { FocusEvent, ReactElement, useMemo } from 'react';

import { Input } from '@opensumi/ide-components';
import { IJSONSchema } from '@opensumi/ide-core-common';

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
    onDropPropertyClick,
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
  const isAdditional = ADDITIONAL_PROPERTY_FLAG in schema || ADDITIONAL_PROPERTIES_KEY in schema;
  const description = schema.description ?? (schema as IJSONSchema).markdownDescription;

  /**
   * 不存在 additionalProperties 的话直接返回 children
   * 为了防止一些属性的 properties 过多，造成页面过长（比如 node 的 linux 配置项），对于 id 非 root 的配置项让其去 launch 文件处理
   * 二期再将这部分能力加上
   */
  // const isDisplayNode = useMemo(() => type !== 'object' , [type, isAdditional])
  if (!isAdditional) {
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
  const isHasProperties = useMemo(() => properties && Object.keys(properties).length > 0, [schema, properties]);

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
          isHasProperties ? (
            <div className={styles.children_field}>
              <div className={styles.dividing}></div>
              <div className={styles.children_container}>{children}</div>
            </div>
          ) : (
            <div className={styles.form_additional}>
              <div className={styles.form_group}>
                <Input
                  className={styles.form_control}
                  defaultValue={label}
                  placeholder={'请输入 Key'}
                  disabled={disabled || (readonlyAsDisabled && readonly)}
                  id={`${id}-key`}
                  name={`${id}-key`}
                  onBlur={!readonly ? handleBlur : undefined}
                  type='text'
                />
                <Input
                  className={styles.form_control}
                  defaultValue={label}
                  placeholder={'请输入 Value'}
                  disabled={disabled || (readonlyAsDisabled && readonly)}
                  id={`${id}-key`}
                  name={`${id}-key`}
                  onBlur={!readonly ? handleBlur : undefined}
                  type='text'
                />
                <RemoveButton className='array-item-remove' disabled={disabled || readonly} registry={registry} />
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
};
