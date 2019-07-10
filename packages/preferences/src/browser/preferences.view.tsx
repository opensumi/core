import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './index.module.less';

export const HelloWorld = observer(() => {
  return (
    <h1 className={ styles.name }>Hello world</h1>
  );
});
