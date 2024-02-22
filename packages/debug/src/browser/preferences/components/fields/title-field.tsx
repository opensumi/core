import { FormContextType, RJSFSchema, StrictRJSFSchema, TitleFieldProps } from '@rjsf/utils';
import React from 'react';

import styles from '../json-widget.module.less';

export const TitleField = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: TitleFieldProps<T, S, F>,
) => {
  const { title } = props;

  return title ? (
    <label title={title} className={styles.field_label}>
      {title}
    </label>
  ) : null;
};
