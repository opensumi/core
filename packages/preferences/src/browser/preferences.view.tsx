import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './index.module.less';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';

export const PreferenceView: ReactEditorComponent<null> = (props) => {
  return (
    <h1 className={ styles.name }>preference</h1>
  );
};
