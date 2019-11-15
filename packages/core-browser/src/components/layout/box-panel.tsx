import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { IEventBus } from '@ali/ide-core-common';
import { RenderedEvent } from '../../layout';

export const BoxPanel: React.FC<{
  children?: Array<React.ReactElement<{ flex?: number; id: string; }>>;
  className?: string;
  direction?: Layout.direction;
  flex?: number;
}> = (({ className, children, direction = 'left-to-right', ...restProps }) => {
  const eventBus = useInjectable<IEventBus>(IEventBus);
  // 挪到root节点
  React.useEffect(() => {
    eventBus.fire(new RenderedEvent());
  }, []);
  return (
    <div {...restProps} className={clsx(styles['box-panel'], className)} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {children && children.map((child) => {
        return(
          <div
            key={child.props.id}
            className={clsx(styles.wrapper)}
            style={child.props.flex ? {flex: child.props.flex} : {}}>
            {child}
          </div>
        )
        ;
      })}
    </div>
  );
});
