import cls from 'classnames';
import React from 'react';
export * from './styles.less';

// Nativa Select
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  props = {
    ...props,
    className: cls('kt_select', props.className),
  };
  return <select {...props} />;
};
