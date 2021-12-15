import React from 'react';
import { observer } from 'mobx-react-lite';
import styles from './hello-world.module.less';

export const HelloWorld = observer(() => <h1 className={styles.name}>Hello world</h1>);
