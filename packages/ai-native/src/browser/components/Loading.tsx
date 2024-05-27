import cls from 'classnames';
import React from 'react';

import { getIcon, Icon } from '@opensumi/ide-components';

import styles from './components.module.less';

export const Loading = React.memo((props: { className?: string }) => (
  <Icon className={cls(props.className, styles.loading_indicator)} iconClass={getIcon('loading')} />
));

Loading.displayName = 'Loading';
