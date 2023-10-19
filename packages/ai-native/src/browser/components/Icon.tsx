import cls from 'classnames';
import React from 'react';

import { Icon, IconProps } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';

export const EnhanceIcon = (props: IconProps & { wrapperStyle?: React.CSSProperties }) => (
  <div className={styles.ai_enhance_icon} style={props.wrapperStyle} onClick={props.onClick}>
    <Icon {...props} className={cls(props.className, styles.icon)} children={null} onClick={() => null} />
    {props.children}
  </div>
);
