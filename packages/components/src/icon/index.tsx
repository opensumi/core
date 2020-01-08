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
  tooltip?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
} & React.HTMLAttributes<HTMLSpanElement>> = (
  { size = 'small', loading, icon, iconClass, className, tooltip, disabled, ...restProps },
) => {
  const { getIcon } = React.useContext(IconContext);
  const iconClx = icon ? getIcon(icon) : iconClass;
  return <span
    {...restProps}
    title={tooltip}
    className={clx(
      styles.icon,
      iconClx,
      className,
      {
        [styles.loading]: loading,
        [styles.disabled]: !!disabled,
        [styles[size]]: !!size,
      },
    )}
    />;
};
