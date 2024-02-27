import { getDefaultRegistry } from '@rjsf/core';
import { FieldProps, FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import React, { useCallback } from 'react';

import { isUndefined } from '@opensumi/ide-core-common';

const DefaultArrayField: any = getDefaultRegistry().fields.ArrayField;

export const ArrayField = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: FieldProps<T, S, F>,
) => {
  const { onChange } = props;

  const handleOnChange = useCallback(
    (newFormData: T) => {
      if (Array.isArray(newFormData)) {
        onChange(newFormData.map((data) => (isUndefined(data) ? '' : data)) as unknown as T);
      }
    },
    [onChange],
  );

  return <DefaultArrayField {...props} onChange={handleOnChange} />;
};
