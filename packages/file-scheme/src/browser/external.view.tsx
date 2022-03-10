import React from 'react';

import { INJECTOR_TOKEN } from '@opensumi/di';
import { localize, useInjectable, isElectronRenderer } from '@opensumi/ide-core-browser';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import styles from './style.module.less';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const srcPath = props.resource.uri.codeUri.fsPath;
  const injector = useInjectable(INJECTOR_TOKEN);

  return (
    <div className={styles.external}>
      {localize('editor.cannotOpenBinary')}
      {isElectronRenderer() ? (
        <a onClick={() => injector.get(IElectronMainUIService).openPath(srcPath)}>{localize('editor.openExternal')}</a>
      ) : null}
    </div>
  );
};
