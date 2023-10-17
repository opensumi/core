import cls from 'classnames';
import React from 'react';

import { Icon, IconProps } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';

export const EnhanceIcon = (props: IconProps) => (
    <div className={styles.ai_enhance_icon}>
      <Icon {...props} className={cls(props.className, styles.icon)} />
    </div>
  );
