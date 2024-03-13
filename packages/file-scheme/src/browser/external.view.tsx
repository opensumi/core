import React from 'react';

import { INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AppConfig, localize, useInjectable } from '@opensumi/ide-core-browser';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import styles from './style.module.less';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const srcPath = props.resource.uri.codeUri.fsPath;
  const injector: Injector = useInjectable(INJECTOR_TOKEN);
  const appConfig: AppConfig = useInjectable(AppConfig);

  return (
    <div className={styles.external}>
      {localize('editor.cannotOpenBinary')}
      {appConfig.isElectronRenderer ? (
        <a onClick={() => injector.get(IElectronMainUIService).openPath(srcPath)}>{localize('editor.openExternal')}</a>
      ) : null}
    </div>
  );
};
