import { WidgetProps } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { Option, Select } from '@opensumi/ide-components';

export const SelectWidget = (props: WidgetProps) => {
  const { schema, value } = props;

  const enumValue = useMemo(() => {
    if (schema && schema.enum) {
      return schema.enum;
    }
    return [];
  }, [schema, schema.enum]);

  return (
    <Select value={value}>
      {enumValue.forEach((data: string) => {
        <Option value={data}>{data}</Option>;
      })}
    </Select>
  );
};
