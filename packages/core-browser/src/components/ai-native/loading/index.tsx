import cls from 'classnames';
import React from 'react';

import { Icon, getIcon } from '@opensumi/ide-components';

import styles from './index.module.less';

export const Loading = React.memo((props: { className?: string }) => (
  <Icon className={cls(props.className, styles.loading_indicator)} iconClass={getIcon('loading')} />
));

Loading.displayName = 'Loading';
