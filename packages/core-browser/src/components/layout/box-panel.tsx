import clsx from 'classnames';
import React from 'react';

import { useInjectable } from '../../react-hooks';
import { AppConfig } from '../../react-providers';

import { Layout } from './layout';
import styles from './styles.module.less';

export interface IChildComponentProps {
  flex?: number;
  defaultSize?: number;
  id: string;
  overflow: string;
}

type ChildComponent = React.ReactElement<IChildComponentProps>;

export const BoxPanel: React.FC<{
  children?: ChildComponent | ChildComponent[];
  className?: string;
  direction?: Layout.direction;
  flex?: number;
  zIndex?: number;
}> = ({ className, children = [], direction = 'left-to-right', ...restProps }) => {
  // convert children to list
  const arrayChildren = React.Children.toArray(children);
  const appConfig = useInjectable<AppConfig>(AppConfig);

  return (
    <div
      ref={() => {
        if (appConfig.didRendered) {
          appConfig.didRendered();
        }
      }}
      {...restProps}
      className={clsx(styles['box-panel'], className)}
      style={{ flexDirection: Layout.getFlexDirection(direction), zIndex: restProps['z-index'] }}
    >
      {arrayChildren.map((child, index) => (
        <div
          key={index}
          className={clsx(styles.wrapper)}
          style={
            child['props']
              ? {
                  flex: child['props'].flex,
                  overflow: child['props'].overflow,
                  zIndex: child['props'].zIndex || child['props']['z-index'],
                  [Layout.getMinSizeProperty(direction)]: child['props'].defaultSize,
                }
              : {}
          }
        >
          {child}
        </div>
      ))}
    </div>
  );
};
