import {
  ADDITIONAL_PROPERTY_FLAG,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WrapIfAdditionalTemplateProps,
} from '@rjsf/utils';
import React, { FocusEvent, useCallback } from 'react';

import { Input } from '@opensumi/ide-components';
import { formatLocalize } from '@opensumi/ide-core-common';

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
  const { readonlyAsDisabled = true } = registry.formContext;
  const { templates } = registry;
  const { RemoveButton } = templates.ButtonTemplates;
  // 如果是用户手动添加 property 则存在该标识
  const isPropertyFlag = ADDITIONAL_PROPERTY_FLAG in schema;

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
