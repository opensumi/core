import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './git.module.less';

export const Git = observer((props) => {
  return (
    <h1 className={ styles.wrap }>Hello git</h1>
  );
});
