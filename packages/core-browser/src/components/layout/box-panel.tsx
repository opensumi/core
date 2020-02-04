import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { IEventBus } from '@ali/ide-core-common';
import { RenderedEvent } from '../../layout';

type ChildComponent = React.ReactElement<{ flex?: number; id: string; }>;

export const BoxPanel: React.FC<{
  children?: ChildComponent | ChildComponent[];
  className?: string;
  direction?: Layout.direction;
  flex?: number;
}> = (({ className, children = [], direction = 'left-to-right', ...restProps }) => {
  const eventBus = useInjectable<IEventBus>(IEventBus);
  // 挪到root节点
  React.useEffect(() => {
    eventBus.fire(new RenderedEvent());
  }, []);

    // convert children to list
  const arrayChildren = React.Children.toArray(children);

  return (
    <div
      {...restProps}
      className={clsx(styles['box-panel'], className)}
      style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {
        arrayChildren.map((child, index) => (
          <div
            key={index}
            className={clsx(styles.wrapper)}
            style={child['props'] && child['props'].flex ? {flex: child['props'].flex, overflow: 'hidden'} : {}}>
            {child}
          </div>
        ))
      }
    </div>
  );
});
