import {
  ADDITIONAL_PROPERTY_FLAG,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WrapIfAdditionalTemplateProps,
  descriptionId,
  getTemplate,
  titleId,
} from '@rjsf/utils';
import React, { FocusEvent, useCallback, useMemo } from 'react';

import { Input } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { IJSONSchema, formatLocalize, localize } from '@opensumi/ide-core-common';

import { MASSIVE_PROPERTY_FLAG } from '../../../common';
import { LaunchService } from '../launch.service';

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
    schema,
  } = props;
  const launchService = useInjectable<LaunchService>(LaunchService);
  const { readonlyAsDisabled = true } = registry.formContext;
  const { templates } = registry;
  const { RemoveButton } = templates.ButtonTemplates;
  // 如果是用户手动添加 property 则存在该标识
  const isPropertyFlag = ADDITIONAL_PROPERTY_FLAG in schema;
  const isMassivePropertyFlag = MASSIVE_PROPERTY_FLAG in schema;

  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
  );

  const description = useMemo(() => schema.description || (schema as IJSONSchema).markdownDescription, [schema]);

  const editLaunchJson = useCallback(async () => {
    await launchService.openLaunchConfiguration();
  }, []);

  if (isMassivePropertyFlag) {
    return (
      <div className={classNames} style={style}>
        {label && (
          <div className={styles.object_title}>
            <TitleFieldTemplate id={titleId<T>(id)} title={label} schema={schema} registry={registry} />
          </div>
        )}
        {description && (
          <div className={styles.object_description}>
            <DescriptionFieldTemplate
              id={descriptionId<T>(id)}
              description={description}
              schema={schema}
              registry={registry}
            />
          </div>
        )}
        <div className={styles.control_wrap}>
          <a onClick={editLaunchJson}>{localize('debug.launch.view.edit.inLaunchJson')}</a>
        </div>
      </div>
    );
  }

  if (!isPropertyFlag) {
    return (
      <div className={classNames} style={style}>
        {children}
      </div>
    );
  }

  const handleBlur = useCallback(
    ({ target }: FocusEvent<HTMLInputElement>) => onKeyChange(target.value),
    [onKeyChange],
  );

  return (
    <div className={classNames} style={style}>
      <div className={styles.additional_field_template}>
        <div className={styles.form_additional_container}>
          <div className={styles.form_additional}>
            <Input
              className={styles.form_control}
              defaultValue={label}
              value={label}
              placeholder={formatLocalize('debug.launch.view.template.input.placeholder', 'Key')}
              disabled={disabled || (readonlyAsDisabled && readonly)}
              id={`${id}-key`}
              name={`${id}-key`}
              onBlur={!readonly ? handleBlur : undefined}
              type='text'
            />
          </div>
          <div className={styles.form_additional_children}>{children}</div>
          <RemoveButton disabled={disabled || readonly} onClick={onDropPropertyClick(label)} registry={registry} />
        </div>
      </div>
    </div>
  );
};
