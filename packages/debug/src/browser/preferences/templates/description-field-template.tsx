import { DescriptionFieldProps, FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import React from 'react';

import styles from './json-templates.module.less';

export const DescriptionFieldTemplate = <
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(
  props: DescriptionFieldProps<T, S, F>,
) => {
  const { id, description } = props;
  if (!description) {
    return null;
  }
  return (
    <span id={id} className={styles.description_field_template}>
      {description}
    </span>
  );
};
