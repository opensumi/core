import * as cls from 'classnames';
import * as React from 'react';
export * from './styles.less';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  props = {
    ...props,
    className: cls('kt_select', props.className),
  };
  return <select {...props} />;
};
