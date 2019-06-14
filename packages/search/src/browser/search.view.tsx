import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './search.module.less';

export const Search = observer(() => {
  return (
    <h1 className={ styles.wrap }>search</h1>
  );
});
