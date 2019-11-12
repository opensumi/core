import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';

export const BoxPanel: React.FC<{
  children?: Array<React.ReactElement<{ size?: string; flex?: number; id: string; }>>;
  className?: string;
  direction?: Layout.direction;
  size?: number;
  flex?: number;
}> = (({ className, children, direction, ...restProps }) => {
  direction = direction || 'left-to-right';
  return (
    <div {...restProps} className={clsx(styles['box-panel'], className)} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {children && children.map((child) => {
        return(
          <div
            key={child.props.id}
            className={clsx(styles.wrapper)}
            style={
              child.props.size ? {[Layout.getSizeProperty(direction!)]: child.props.size} : {flex: child.props.flex || 1}
            }>
            {child}
          </div>
        )
        ;
      })}
    </div>
  );
});
