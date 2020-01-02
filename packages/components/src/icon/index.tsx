import * as React from 'react';
import clx from 'classnames';

import * as styles from './style.module.less';

export interface IiconContext {
  getIcon: (iconKey: string) => string;
}

export const IconContext = React.createContext<IiconContext>({
  getIcon: (iconKey) => iconKey,
});

export function IconContextProvider(props: React.PropsWithChildren<{ value: IiconContext }>) {
  return (
    <IconContext.Provider value={props.value}>
      <IconContext.Consumer>
        {(value) => props.value === value ? props.children : null}
      </IconContext.Consumer>
    </IconContext.Provider>
  );
}

export const Icon: React.FC<{
  title?: string;
  icon?: string;
  iconClass?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
} & React.HTMLAttributes<HTMLDivElement>> = (
  { size = 'small', loading, icon, iconClass, className, ...restProps },
) => {
  const { getIcon } = React.useContext(IconContext);
  const iconClx = icon ? getIcon(icon) : iconClass;
  return <span
    {...restProps}
    className={clx(
      styles.icon,
      iconClx,
      className,
      {
        [styles.loading]: loading,
        [styles[size]]: !!size,
      },
    )}
    />;
};
