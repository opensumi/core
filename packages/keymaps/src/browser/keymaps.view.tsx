import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import * as styles from './keymaps.module.less';

export const KeymapsView: ReactEditorComponent<null> = observer(() => {
  return (
    <div className={ styles.name }>Keyboard Shortcuts</div>
  );
});
