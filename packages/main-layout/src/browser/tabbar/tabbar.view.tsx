import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo } from '@ali/ide-core-browser';

export const TabbarRenderer: React.FC<{
  className?: string;
  direction?: Layout.direction;
  components: ComponentRegistryInfo[];
}> = (({ className, direction = 'left-to-right', components, ...restProps }) => {
  return (
    <div className={clsx( styles.tabbar, className )} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {components.map((item) => <li>
        <div className={clsx(item.options!.iconClass)}></div>
      </li>)}
    </div>
  );
});
