import { FieldTemplateProps } from '@rjsf/utils';
import cls from 'classnames';
import React, { useMemo } from 'react';

import styles from './json-templates.module.less';

export const FieldTemplate = (props: FieldTemplateProps) => {
  const { classNames, style, help, description, errors, children, id, schema, label, displayLabel } = props;
  const renderDescription = useMemo(() => {
    if (id === 'root' || schema.type === 'array') {
      return null;
    }

    return description;
  }, [id, schema, schema.type, description]);

  const renderLabel = useMemo(() => {
    if (id === 'root' || schema.type === 'array' || displayLabel === false) {
      return null;
    }

    return (
      label && (
        <label title={label} className={styles.field_label}>
          {label}
        </label>
      )
    );
  }, [id, schema, schema.type, label, displayLabel]);

  return (
    <div className={cls(classNames, styles.field_template)} style={style}>
      {renderLabel}
      {renderDescription}
      {children}
      {errors}
      {help}
    </div>
  );
};
