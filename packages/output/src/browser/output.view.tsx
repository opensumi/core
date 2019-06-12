import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './output.module.less';

export const Output = observer(() => {
  return (
    <h1 className={ styles.name }>Hello world</h1>
  );
});
