import * as React from 'react';
import * as clx from 'classnames';

import './style.less';

interface ITabsProps {
  className?: string;
  tabs: (string | React.ReactNode)[];
  value: number;
  onChange: (index: number) => void;
}

export const Tabs = (props: ITabsProps) => {
  const { tabs, className, value, onChange } = props;
  const onClick = React.useCallback((index: number) => {
    if (typeof onChange === 'function') {
      onChange(index);
    }
  }, []);

  return (
    <div className={clx('kt-tabs', className )}>
      {
        tabs.map((tabContent, i) => {
          const selectedClassName = i === value ? 'kt-tab-selected' : '';
          if (typeof tabContent === 'string') {
            return <div
              key={i}
              className={clx('kt-tab', selectedClassName)}
              onClick={onClick.bind(null, i)}>
              {tabContent}
            </div>;
          }
          return <div
            key={i}
            className={clx('kt-custom-tab', selectedClassName)}
            onClick={onClick.bind(null, i)}>
            {tabContent}
          </div>;
        })
      }
    </div>
  );
};
