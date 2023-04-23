import { WidgetProps } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { Option, Select } from '@opensumi/ide-components';

import styles from './json-widget.module.less';

export const SelectWidget = (props: WidgetProps) => {
  const { schema, value, id } = props;

  const enumValue = useMemo(() => {
    if (schema && schema.enum) {
      return schema.enum;
    }
    return [];
  }, [schema, schema.enum]);

  return (
    <Select key={id} value={value} className={styles.select_widget_control} dropdownRenderType='absolute'>
      {enumValue.map((data: string) => (
        <Option value={data} label={data} key={data}>
          {data}
        </Option>
      ))}
    </Select>
  );
};
