import { FormContextType, TitleFieldProps, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import classNames from 'classnames';
import React from 'react';

import styles from '../json-widget.module.less';

export const TitleField = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: TitleFieldProps<T, S, F>,
) => {
  const { id, required, registry, title } = props;
  const { formContext } = registry;
  const { colon = true } = formContext;

  let labelChildren = title;
  if (colon && typeof title === 'string' && title.trim() !== '') {
    labelChildren = title.replace(/[：:]\s*$/, '');
  }

  const handleLabelClick = () => {
    if (!id) {
      return;
    }

    const control: HTMLLabelElement | null = document.querySelector(`[id="${id}"]`);
    if (control && control.focus) {
      control.focus();
    }
  };

  return title ? (
    <label title={title} className={styles.field_label}>
      {title}
    </label>
  ) : null;
};
