import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './hello-world.module.less';

export const HelloWorld = observer(() => {
  return (
    <div className = {styles.overlay}>
      <h1 className={ styles.name }>Hello world Overlay</h1>
    </div>
  );
});
