import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
  descriptionId,
  getTemplate,
  titleId,
} from '@rjsf/utils';
import React, { useMemo } from 'react';

import { Option, Select } from '@opensumi/ide-components';

import styles from './json-widget.module.less';

export const SelectWidget = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: WidgetProps<T, S, F>,
) => {
  const { schema, value, id, registry, uiOptions, name, required, onChange } = props;
  const description = schema.description;

  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );

  const enumValue = useMemo(() => {
    if (schema && schema.enum) {
      return schema.enum;
    }
    return [];
  }, [schema, schema.enum]);

  return (
    <div className={styles.select_widget_control}>
      {name && (
        <div className={styles.object_title}>
          <TitleFieldTemplate
            id={titleId<T>(id)}
            title={name}
            required={required}
            schema={schema}
            registry={registry}
          />
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
      <Select key={id} value={value} dropdownRenderType='absolute' onChange={onChange}>
        {enumValue.map((data: string) => (
          <Option value={data} label={data} key={data}>
            {data}
          </Option>
        ))}
      </Select>
    </div>
  );
};
