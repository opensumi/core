import React from 'react';
import clsx from 'classnames';
import styles from './styles.module.less';
import { Layout } from './layout';
// TODO: 类型标准化
type ChildComponent = React.ReactElement<{ flex?: number; defaultSize?: number; id: string; overflow: string; }>;

export const BoxPanel: React.FC<{
  children?: ChildComponent | ChildComponent[];
  className?: string;
  direction?: Layout.direction;
  flex?: number;
  zIndex?: number
}> = (({ className, children = [], direction = 'left-to-right', ...restProps }) => {
  // convert children to list
  const arrayChildren = React.Children.toArray(children);

  return (
    <div
      {...restProps}
      className={clsx(styles['box-panel'], className)}
      style={{ flexDirection: Layout.getFlexDirection(direction), zIndex: restProps['z-index'] }}>
      {
        arrayChildren.map((child, index) => (
          <div
            key={index}
            className={clsx(styles.wrapper)}
            style={child['props'] ? {
              flex: child['props'].flex,
              overflow: child['props'].overflow,
              zIndex: child['props'].zIndex || child['props']['z-index'],
              [Layout.getMinSizeProperty(direction)]: child['props'].defaultSize,
            } : {}}>
            {child}
          </div>
        ))
      }
    </div>
  );
});
