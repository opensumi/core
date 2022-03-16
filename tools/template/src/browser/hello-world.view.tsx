import { observer } from 'mobx-react-lite';
import React from 'react';

import styles from './hello-world.module.less';

export const HelloWorld = observer(() => <h1 className={styles.name}>Hello world</h1>);
