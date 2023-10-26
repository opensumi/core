import cls from 'classnames';
import React from 'react';

import { Icon, IconProps } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';

interface IEnhanceIconProps extends IconProps {
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
}

export const EnhanceIcon = React.forwardRef<HTMLDivElement | null, IEnhanceIconProps>(
  (props: IEnhanceIconProps, ref?) => (
    <div
      className={cls(props.wrapperClassName, styles.ai_enhance_icon)}
      style={props.wrapperStyle}
      onClick={props.onClick}
      ref={ref}
    >
      <Icon {...props} className={cls(props.className, styles.icon)} children={null} onClick={() => null} />
      {props.children && <span className={styles.children_wrap}>{props.children}</span>}
    </div>
  ),
);
