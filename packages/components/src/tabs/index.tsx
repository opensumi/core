import clx from 'classnames';
import React from 'react';

import './style.less';

export interface ITabsProps {
  className?: string;
  tabs: (string | React.ReactNode)[];
  value: number | string;
  mini?: boolean;
  style?: React.CSSProperties;
  onChange: (index: number) => void;
}

export const Tabs = (props: ITabsProps) => {
  const { tabs, className, value, onChange, mini, style, ...restProps } = props;
  const onClick = React.useCallback((index: number) => {
    if (typeof onChange === 'function') {
      onChange(index);
    }
  }, []);

  return (
    <div {...restProps} style={style} className={clx('kt-tabs', className, { ['kt-tabs-mini']: mini })}>
      {tabs.map((tabContent, i) => {
        const selectedClassName = i === value ? 'kt-tab-selected' : '';
        if (typeof tabContent === 'string') {
          return (
            <div
              key={i}
              className={clx('kt-tab', selectedClassName, { ['kt-mini-tab']: mini })}
              onClick={onClick.bind(null, i)}
            >
              {tabContent}
            </div>
          );
        }
        return (
          <div
            key={i}
            className={clx('kt-custom-tab', selectedClassName, { ['kt-mini-tab']: mini })}
            onClick={onClick.bind(null, i)}
          >
            {tabContent}
          </div>
        );
      })}
    </div>
  );
};
