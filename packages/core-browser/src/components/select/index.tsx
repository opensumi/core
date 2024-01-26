import React from 'react';

import { clxx } from '@opensumi/ide-utils/lib/clx';
export * from './styles.less';

// Native Select
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  props = {
    ...props,
    className: clxx('kt_select', props.className),
  };
  return <select {...props} />;
};
