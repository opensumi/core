import { DescriptionFieldProps, FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { IJSONSchema } from '@opensumi/ide-core-common';

import styles from './json-templates.module.less';

export const DescriptionFieldTemplate = <
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(
  props: DescriptionFieldProps<T, S, F>,
) => {
  const { id, schema } = props;
  const description = useMemo(
    () => schema.description ?? (schema as IJSONSchema).markdownDescription,
    [schema, schema.description, (schema as IJSONSchema).markdownDescription],
  );

  if (!description) {
    return null;
  }
  return (
    <span id={id} className={styles.description_field_template}>
      {description}
    </span>
  );
};
