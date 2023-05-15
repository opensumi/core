import { getDefaultRegistry } from '@rjsf/core';
import { FieldProps } from '@rjsf/utils';
import { FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import React from 'react';

const DefaultObjectField: any = getDefaultRegistry().fields.ObjectField;

export const ObjectField = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: FieldProps<T, S, F>,
) => <DefaultObjectField {...props} />;
